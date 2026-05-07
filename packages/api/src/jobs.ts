import {
  type JobType,
  type JobsOptions,
  Queue,
  type Job as RawJob,
  Worker,
} from "bullmq";
import { Redis as IORedis } from "ioredis";

import { env } from "./env.js";
import {
  type ImportImageOpts,
  runImportImage,
  sweepUnconfirmedImages,
} from "./image/image.service.js";
import { type JobContext, runWithJobCtx } from "./job-context.js";
import { getLog, logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";
import {
  type ImportStravaActivityOpts,
  runImportStravaActivity,
} from "./strava/import.js";
import { type ImportTrackOpts, runImportTrack } from "./track/imports.js";
import {
  populateDemElevation,
  populatePreviewImages,
} from "./track/track.service.js";

export interface JobMeta {
  enqueuedByReqId?: string;
  enqueuedByReqUserId?: string;
}

export type JobName = keyof typeof jobRegistry;
export type JobData<Name extends JobName = JobName> = Parameters<
  (typeof jobRegistry)[Name]["handler"]
>[0];

export type JobPayload<Name extends JobName = JobName> = {
  data: JobData<Name>;
  meta: JobMeta;
};
export type Job<Name extends JobName = JobName> = RawJob<JobPayload<Name>>;

type AppWorker = Worker<JobPayload>;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
redisConnection.on("error", (err: unknown) => {
  logger.error({ err }, "Redis connection error");
});

const cpuQueue = new Queue("plantopo.cpu", {
  connection: redisConnection,
  defaultJobOptions,
});

const defaultQueue = new Queue("plantopo.default", {
  connection: redisConnection,
  defaultJobOptions,
});

export const jobRegistry = {
  "recordedTrack.populateDemElevation": {
    queue: cpuQueue,
    handler: async (data: { trackId: string }) => {
      await populateDemElevation(data.trackId);
    },
  },
  "recordedTrack.populatePreviewImages": {
    queue: cpuQueue,
    handler: async (data: { trackId: string }) => {
      await populatePreviewImages(data.trackId);
    },
  },
  "image.sweepUnconfirmed": {
    queue: defaultQueue,
    handler: async (_data: Record<string, never>) => {
      await sweepUnconfirmedImages();
    },
  },
  "image.import": {
    queue: defaultQueue,
    handler: async (data: ImportImageOpts) => {
      await runImportImage(data);
    },
  },
  "track.import": {
    queue: defaultQueue,
    handler: async (data: ImportTrackOpts) => {
      await runImportTrack(data);
    },
  },
  "strava.importActivity": {
    queue: defaultQueue,
    handler: async (data: ImportStravaActivityOpts) => {
      await runImportStravaActivity(data);
    },
  },
} as const;

export async function enqueueJob<Name extends JobName>(
  name: Name,
  data: JobData<Name>,
  opts?: JobsOptions,
): Promise<Job> {
  const def = jobRegistry[name];
  if (!def) throw new Error(`Unknown job: ${name}`);

  const requestContext = getRequestContext();
  const meta: JobMeta = {
    enqueuedByReqId: requestContext?.reqId,
    enqueuedByReqUserId: requestContext?.user?.id,
  };

  const job = await def.queue.add(name, { meta, data }, opts);

  getLog().info(
    { jobId: job.id, jobName: name, jobMeta: meta },
    "Job enqueued",
  );

  return job as Job<Name>;
}

export async function resetJobsByName<Name extends JobName>(
  name: Name,
): Promise<void> {
  const def = jobRegistry[name];
  if (!def) throw new Error(`Unknown job: ${name}`);

  const queue = def.queue;
  const jobs = await queue.getJobs();
  for (const job of jobs) {
    if (job.name === name) {
      try {
        await job.remove();
        getLog().info(
          { jobId: job.id, jobName: name },
          "Job removed during reset",
        );
      } catch (err) {
        getLog().warn(
          { jobId: job.id, jobName: name, err },
          "Failed to remove job during reset",
        );
      }
    }
  }
}

function startQueueWorker(queueName: string, concurrency: number): AppWorker {
  const worker: AppWorker = new Worker(
    queueName,
    async job => {
      const { meta, data } = job.data as JobPayload;

      const jobCtx: JobContext = {
        id: job.id!,
        name: job.name,
        logger: logger.child({
          jobId: job.id,
          jobName: job.name,
          jobMeta: meta,
        }),
      };

      await runWithJobCtx(jobCtx, async () => {
        const def = jobRegistry[job.name as JobName];
        if (!def) {
          jobCtx.logger.error("Unknown job name");
          throw new Error(`Unknown job name: ${job.name}`);
        }

        jobCtx.logger.info("Job started");
        await (def.handler as (data: JobData<JobName>) => Promise<void>)(data);
        jobCtx.logger.info("Job completed");
      });
    },
    { connection: redisConnection, concurrency },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, jobMeta: job?.data.meta, err },
      "Job failed",
    );
  });

  return worker;
}

export async function scheduleRepeatableJobs(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await defaultQueue.add(
    "image.sweepUnconfirmed",
    { data: {}, meta: {} },
    { repeat: { every: 30 * 60 * 1000 }, jobId: "image.sweepUnconfirmed" },
  );
}

export function startWorkers(): AppWorker[] {
  const workers = [
    startQueueWorker(cpuQueue.name, 1),
    startQueueWorker(defaultQueue.name, 10),
  ];
  logger.info("Workers started");
  return workers;
}

export async function closeJobQueues(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    await cpuQueue.close();
    await defaultQueue.close();
    await redisConnection.quit();
  }
}

export async function exportPrometheusMetrics() {
  return (
    await Promise.all([
      cpuQueue.exportPrometheusMetrics(),
      defaultQueue.exportPrometheusMetrics(),
    ])
  ).join("\n");
}

export async function listJobs<Name extends JobName>(
  name: Name,
  types?: JobType | JobType[],
  start?: number,
  end?: number,
): Promise<Job<Name>[]> {
  const def = jobRegistry[name];
  if (!def) throw new Error(`Unknown job: ${name}`);

  const queue = def.queue;
  const jobs = await queue.getJobs(types, start, end);
  return jobs.filter(job => job.name === name) as Job[];
}

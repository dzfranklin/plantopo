import { type Job, type JobsOptions, Queue, Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";

import { env } from "./env.js";
import { type JobContext, runWithJobCtx } from "./job-context.js";
import { getLog, logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";
import { populateDemElevation } from "./track/track.service.js";

type JobName = keyof typeof jobRegistry;
type JobData<Name extends JobName = JobName> = Parameters<
  (typeof jobRegistry)[Name]["handler"]
>[0];

export interface JobMeta {
  enqueuedByReqId?: string;
  enqueuedByReqUserId?: string;
}

type QueueJobData<TData = unknown> = { data: TData; meta: JobMeta };
type AppQueue = Queue<QueueJobData>;
type AppWorker = Worker<QueueJobData>;

let redisConnection: IORedis;
let cpuQueue: AppQueue;
let defaultQueue: AppQueue;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

if (process.env.NODE_ENV === "test") {
  const { testQueue } = await import("./test/helpers.js");
  cpuQueue = testQueue("plantopo.cpu");
  defaultQueue = testQueue("plantopo.default");
} else {
  redisConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redisConnection.on("error", (err: unknown) => {
    logger.error({ err }, "Redis connection error");
  });

  cpuQueue = new Queue("plantopo.cpu", {
    connection: redisConnection,
    defaultJobOptions,
  });

  defaultQueue = new Queue("plantopo.default", {
    connection: redisConnection,
    defaultJobOptions,
  });
}

export const jobRegistry = {
  "recordedTrack.populateDemElevation": {
    queue: cpuQueue,
    handler: async (data: { trackId: string }) => {
      await populateDemElevation(data.trackId);
    },
  },
} as const;

export async function enqueueJob<Name extends JobName>(
  name: Name,
  data: JobData<Name>,
  opts?: JobsOptions,
): Promise<Job<QueueJobData<JobData<Name>>>> {
  const def = jobRegistry[name];
  if (!def) throw new Error(`Unknown job: ${name}`);

  const requestContext = getRequestContext();
  const meta: JobMeta = {
    enqueuedByReqId: requestContext?.reqID,
    enqueuedByReqUserId: requestContext?.user?.id,
  };

  const job = await def.queue.add(name, { meta, data }, opts);

  getLog().info(
    { jobId: job.id, jobName: name, jobMeta: meta },
    "Job enqueued",
  );

  return job as Job<QueueJobData<JobData<Name>>>;
}

function startQueueWorker(queueName: string, concurrency: number): AppWorker {
  const worker: AppWorker = new Worker(
    queueName,
    async job => {
      const { meta, data } = job.data as QueueJobData<JobData>;

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

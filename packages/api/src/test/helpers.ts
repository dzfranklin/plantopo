/* eslint-disable @typescript-eslint/no-explicit-any */

const enqueuedJobs: { jobId: string; name: string; data: unknown }[] = [];

export function testQueue(_name: string): any {
  let nextId = 1;

  return {
    add: async (
      name: string,
      { data }: { meta: unknown; data: unknown },
      { jobId }: { jobId?: string } = {},
    ) => {
      jobId = jobId ?? (nextId++).toString();
      if (enqueuedJobs.some(job => job.jobId === jobId)) {
        return { id: jobId };
      }
      enqueuedJobs.push({ jobId, name, data });
      return { id: jobId };
    },
  };
}

export function getEnqueuedJobs(): { name: string; data: unknown }[] {
  return enqueuedJobs.map(({ name, data }) => ({ name, data }));
}

export function clearEnqueuedJobs(): void {
  enqueuedJobs.length = 0;
}

import { type JobData, type JobName, listJobs } from "../jobs.js";

export async function getEnqueuedJobs<Name extends JobName>(
  name: Name,
): Promise<JobData<Name>[]> {
  return (await listJobs(name, "waiting")).map(job => job.data.data).reverse();
}

import { AsyncLocalStorage } from "async_hooks";
import type pino from "pino";

export interface JobContext {
  id: string;
  name: string;
  logger: pino.Logger;
}

const jobContextStore = new AsyncLocalStorage<JobContext>();

export function getJobContext(): JobContext | null {
  return jobContextStore.getStore() ?? null;
}

export function runWithJobCtx<T>(ctx: JobContext, fn: () => T): T {
  return jobContextStore.run(ctx, fn);
}

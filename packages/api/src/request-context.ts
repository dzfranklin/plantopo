import { AsyncLocalStorage } from "async_hooks";
import type pino from "pino";

import type { ClientInfo } from "@pt/shared";

import type { User } from "./auth/auth.js";

export interface RequestContext {
  reqId: string;
  path: string;
  logger: pino.Logger;
  user: User | null;
  client?: ClientInfo;
}

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function requestContext(): RequestContext {
  const value = requestContextStore.getStore() as RequestContext | undefined;
  if (!value) throw new Error("No request context available");
  return value;
}

export function getRequestContext(): RequestContext | null {
  return (requestContextStore.getStore() as RequestContext | undefined) ?? null;
}

export function runWithRequestCtx<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStore.run(ctx, fn);
}

import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

interface LogBindings {
  reqId?: string;
  userId?: string;
}

const logStore = new AsyncLocalStorage<LogBindings>();

export { logStore };

/** Returns a logger with the current request-scoped bindings, or the root logger if called outside a request. */
export function getLog() {
  const bindings = logStore.getStore();
  return bindings ? logger.child(bindings) : logger;
}

/** Merges additional bindings into the current request context. */
export function bindLog(bindings: Partial<LogBindings>) {
  const store = logStore.getStore();
  if (store) Object.assign(store, bindings);
}

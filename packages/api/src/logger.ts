import pino from "pino";

import { getRequestContext } from "./request-context.js";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

/** Returns a logger with the current request-scoped bindings, or the root logger if called outside a request. */
export function getLog() {
  return getRequestContext()?.logger ?? logger;
}

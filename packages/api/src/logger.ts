import pino from "pino";

import { getJobContext } from "./job-context.js";
import { getRequestContext } from "./request-context.js";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

export function getLog() {
  return getRequestContext()?.logger ?? getJobContext()?.logger ?? logger;
}

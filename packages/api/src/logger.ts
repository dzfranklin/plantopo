import pino from "pino";

import { getJobContext } from "./job-context.js";
import { getRequestContext } from "./request-context.js";

const isDev = process.env.NODE_ENV !== "production";
const ownFilename = import.meta.filename.replace(import.meta.dirname + "/", "");

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  mixin(_mergeObject, level, _logger) {
    if (level >= pino.levels.values.warn!) {
      return { stack: getNonLogCallerStack() };
    }
    return {};
  },
  ...(isDev && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

export function getLog() {
  return getRequestContext()?.logger ?? getJobContext()?.logger ?? logger;
}

function getNonLogCallerStack(maxDepth: number = 6): string[] | undefined {
  const err = new Error();
  const stack = err.stack?.split("\n").slice(1);
  if (!stack) return undefined;

  let i = 0;
  for (; i < stack.length; i++) {
    const line = stack[i]!;
    if (line.includes("node_modules/pino") || line.includes(ownFilename)) {
      continue;
    }
    break;
  }

  if (i >= stack.length) return undefined;

  const out: string[] = [];
  for (; i < stack.length && out.length < maxDepth; i++) {
    const line = stack[i]!.trim();
    const match = line.match(/at\s+(.*)/);
    if (match) out.push(match[1]!);
    else out.push(line);
  }
  return out;
}

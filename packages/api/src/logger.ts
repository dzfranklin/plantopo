import pino from "pino";

import { getJobContext } from "./job-context.js";
import { getRequestContext } from "./request-context.js";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  mixin(_mergeObject, level, _logger) {
    if (level >= pino.levels.values.warn!) {
      return { stack: getNonLogCallerStack() };
    }
    return {};
  },
  serializers: {
    err: err => {
      const base = pino.stdSerializers.err(err);
      for (const key in base) {
        const value = base[key]!;

        if (key === "message" || key === "stack") {
          if (typeof value === "string") {
            base[key] = truncateString(value, 500);
          }
        } else if (typeof value === "string") {
          base[key] = truncateString(value, 100);
        } else {
          base[key] = truncateString(String(value), 200);
        }
      }
      return base;
    },
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname,isDev,env,extra,client",
        },
      }
    : { target: "pino/file", options: { destination: 1 } },
});

export function getLog() {
  return getRequestContext()?.logger ?? getJobContext()?.logger ?? logger;
}

function truncateString(str: string, max: number): string {
  if (str.length <= max) return str;
  const half = Math.floor(max / 2);
  return (
    str.slice(0, half) +
    ` ... [${str.length - max} chars truncated] ... ` +
    str.slice(-half)
  );
}

function getNonLogCallerStack(maxDepth: number = 6): string[] | undefined {
  const err = new Error();
  const stack = err.stack?.split("\n").slice(1);
  if (!stack) return undefined;

  let i = 0;
  for (; i < stack.length; i++) {
    const line = stack[i]!;
    if (line.includes("node_modules/pino") || line.includes("logger.ts")) {
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

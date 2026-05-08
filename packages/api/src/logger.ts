import { TRPCError } from "@trpc/server";
import { inspect } from "node:util";
import pino, { type LoggerOptions } from "pino";

import { ClientError } from "./errors.js";
import { getJobContext } from "./job-context.js";
import { getRequestContext } from "./request-context.js";

const isDev = process.env.NODE_ENV !== "production";

let transport: LoggerOptions["transport"] = {
  target: "pino/file",
  options: { destination: 1 },
};
if (isDev) {
  transport = {
    target: "pino-pretty",
    options: { colorize: true, ignore: "pid,hostname,isDev,env,extra,client" },
  };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin(_mergeObject, level, _logger) {
    if (level >= pino.levels.values.warn!) {
      return { stack: getNonLogCallerStack() };
    }
    return {};
  },
  serializers: {}, // formatter expects unserialized err
  formatters: {
    level(label) {
      return { level: label };
    },
    log: formatLogObject,
  },
  transport: transport,
});

export function getLog() {
  return getRequestContext()?.logger ?? getJobContext()?.logger ?? logger;
}

const formatOpts = {
  maxStringLength: isDev ? 150 : 1_000,
  maxArrayLength: 10,
  depth: 2,
};

function formatLogObject(
  obj: Record<string, unknown>,
  outputObjectDepth = 1,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "number" || typeof val === "boolean" || val === null) {
      out[key] = val;
    } else if (typeof val === "string") {
      out[key] = truncateString(val);
    } else if (key === "err" && val instanceof Error) {
      out["err.inspect"] = inspect(val, formatOpts);
      out["err"] = {
        constructor: val.constructor,
        name: val.name,
        message: truncateString(val.message),
        stack: val.stack ? truncateString(val.stack) : undefined,
        cause: val.cause ? inspect(val.cause, formatOpts) : undefined,
      };
      if (val instanceof TRPCError) out["err.code"] = val.code;
      if (val instanceof ClientError) out["err.clientError"] = val.clientError;
    } else if (outputObjectDepth > 0 && isPlainObject(val)) {
      out[key] = formatLogObject(
        val as Record<string, unknown>,
        outputObjectDepth - 1,
      );
    } else {
      out[key] = inspect(val, formatOpts);
    }
  }
  return out;
}

function truncateString(str: string): string {
  if (str.length <= formatOpts.maxStringLength) return str;
  return inspect(str, formatOpts).slice(1, -1); // remove quotes added by inspect
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    (val.constructor === Object || Object.getPrototypeOf(val) === null)
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

export default logger;

import pino from "pino/browser";

// Using pino/browser ensures tests running in node use console.* methods
// instead of writing to stdout so vitest captures the output.

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: { asObject: true },
});

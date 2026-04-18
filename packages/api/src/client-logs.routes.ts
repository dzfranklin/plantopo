import { fromNodeHeaders } from "better-auth/node";
import express, { type Router } from "express";

import { auth } from "./auth/auth.js";
import { getLog } from "./logger.js";

const isDev = process.env.NODE_ENV !== "production";

const windowNumbers = new Map<string, number>();
let nextWindowNum = 1;

function getWindowNum(windowId: string): number {
  let num = windowNumbers.get(windowId);
  if (num === undefined) {
    num = nextWindowNum++;
    windowNumbers.set(windowId, num);
  }
  return num;
}

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
const VALID_LEVELS = new Set<string>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);

interface LogEntry {
  level: Level;
  msg: string;
  time?: number;
  [key: string]: unknown;
}

export function registerClientLogsRoutes(app: Router) {
  app.post("/api/v1/client-logs", express.json(), async (req, res) => {
    if (!isDev) {
      res.status(404).end();
      return;
    }

    const { windowId, entries } = req.body as {
      windowId?: string;
      entries?: unknown[];
    };

    if (typeof windowId !== "string" || !Array.isArray(entries)) {
      res.status(400).end();
      return;
    }

    const session = await auth.api
      .getSession({ headers: fromNodeHeaders(req.headers) })
      .catch(() => null);

    const windowNum = getWindowNum(windowId);
    const log = getLog().child({
      ...(session?.user.id && { userId: session.user.id }),
    });

    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null) continue;
      const { level, msg, time, ...rest } = entry as LogEntry;
      const lvl: Level = VALID_LEVELS.has(level) ? level : "info";
      const prefixedMsg = `[window ${windowNum}] ${msg}`;
      log[lvl]({ time, ...rest }, prefixedMsg);
    }

    res.status(204).end();
  });
}

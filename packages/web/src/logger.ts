// pino/browser ensures tests in node use console.* so vitest captures output.
import pino from "pino/browser";

import { getDebugFlag, subscribeDebugFlags } from "@/hooks/debug-flags";

// --- Logger ---

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: {
    asObject: true,
    ...(import.meta.env.DEV && { transmit: { send: pinoSend } }),
  },
});

export default logger;

// --- Log viewer ---

export type LogEntry = {
  level: string;
  msg: string;
  time: number;
  [key: string]: unknown;
};

export type LogViewerState = { entries: readonly LogEntry[] };

let logViewerState: LogViewerState | null = getDebugFlag("enableLogViewer")
  ? { entries: [] }
  : null;
const LOG_VIEWER_EVENT = "logViewerChange";

subscribeDebugFlags(() => {
  const enabled = getDebugFlag("enableLogViewer");
  if (enabled && !logViewerState) {
    logViewerState = { entries: [] };
    window.dispatchEvent(new Event(LOG_VIEWER_EVENT));
  } else if (!enabled && logViewerState) {
    logViewerState = null;
    window.dispatchEvent(new Event(LOG_VIEWER_EVENT));
  }
});

export function clearLogViewer() {
  if (!logViewerState) return;
  logViewerState = { entries: [] };
  window.dispatchEvent(new Event(LOG_VIEWER_EVENT));
}

export function getLogViewerState(): LogViewerState | null {
  return logViewerState;
}

export function subscribeLogViewer(onChange: () => void) {
  window.addEventListener(LOG_VIEWER_EVENT, onChange);
  return () => window.removeEventListener(LOG_VIEWER_EVENT, onChange);
}

// --- Log shipping (DEV only) ---

const ENDPOINT = "/api/v1/client-logs";
const windowId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
const shipQueue: LogEntry[] = [];
let shipScheduled = false;

// --- Utilities ---

export function safeStringify(value: unknown, indent?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "function") return undefined;
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
        if (!isPlainObject(val) && !Array.isArray(val))
          return `[${val.constructor?.name ?? "Object"}]`;
      }
      return val;
    },
    indent,
  );
}

// --- Internal ---

function enqueue(entry: LogEntry) {
  if (logViewerState) {
    const prev = logViewerState.entries;
    const trimmed = prev.length >= 500 ? prev.slice(1) : prev;
    logViewerState = { entries: [...trimmed, entry] };
    // Defer so logging during a React render doesn't trigger a state update in another component
    queueMicrotask(() => window.dispatchEvent(new Event(LOG_VIEWER_EVENT)));
  }

  if (import.meta.env.DEV) {
    shipQueue.push(entry);
    if (!shipScheduled) {
      shipScheduled = true;
      requestIdleCallback(shipScheduledNow, { timeout: 10_000 });
    }
  }
}

function shipScheduledNow() {
  shipScheduled = false;
  const entries = shipQueue.splice(0);
  if (!entries.length) return;
  const body = safeStringify({ windowId, entries });

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}

// Called by pino transmit for every log, independently of console output.
function pinoSend(level: pino.Level, logEvent: pino.LogEvent) {
  if (level === "trace") return;
  const { ts, messages, bindings } = logEvent;
  const bindingObj = Object.assign({}, ...bindings);
  // messages is [dataObj?, msg] when using logger.info({...}, "msg") form,
  // or just [msg] when using logger.info("msg") form.
  const last = messages[messages.length - 1];
  const msg = typeof last === "string" ? last : String(last ?? "");
  const extra =
    messages.length > 1
      ? Object.assign(bindingObj, ...messages.slice(0, -1))
      : bindingObj;
  enqueue({ level, msg, time: ts, ...extra } as LogEntry);
}

// Patch console.* to forward non-pino logs into enqueue.
// pino with asObject:true calls console[method] with a single object
// { level: number, msg: string, ... } — detect and skip to avoid double-send.
const methods = ["log", "trace", "debug", "info", "warn", "error"] as const;
for (const method of methods) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    original(...args);
    const first = args[0];
    if (
      typeof first === "object" &&
      first !== null &&
      typeof (first as Record<string, unknown>).level === "number" &&
      typeof (first as Record<string, unknown>).msg === "string"
    )
      return;
    const extras: Record<string, unknown> = {};
    const parts: string[] = [];
    let objIdx = 0;
    const interpolated = interpolateConsoleArgs(args);
    for (const a of interpolated) {
      if (isPlainObject(a) || Array.isArray(a)) {
        const key = `arg${objIdx++}`;
        extras[key] = sanitizeForLog(a);
        parts.push(`[${key}]`);
      } else {
        parts.push(String(a));
      }
    }
    enqueue({
      level: method === "log" ? "info" : method,
      msg: parts.join(" "),
      time: Date.now(),
      ...extras,
    } as LogEntry);
  };
}

function interpolateConsoleArgs(args: unknown[]): unknown[] {
  if (args.length < 2 || typeof args[0] !== "string" || !args[0].includes("%s"))
    return args;
  let i = 1;
  const msg = args[0].replace(/%s/g, () =>
    i < args.length ? String(args[i++]) : "%s",
  );
  return [msg, ...args.slice(i)];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function sanitizeForLog(v: unknown): unknown {
  if (isReactElement(v)) return "[ReactElement]";
  if (Array.isArray(v)) return v.map(sanitizeForLog);
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = sanitizeForLog(v[k]);
    return out;
  }
  return v;
}

function isReactElement(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    "$$typeof" in v &&
    typeof (v as Record<string, unknown>)["$$typeof"] === "symbol"
  );
}

window.addEventListener("error", e => {
  logger.error(
    { err: e.error, source: `${e.filename}:${e.lineno}:${e.colno}` },
    "error event: " + e.message,
  );
});

window.addEventListener("unhandledrejection", e => {
  const r = e.reason;
  logger.error(
    { err: r instanceof Error ? r : undefined },
    "unhandled rejection: " + (r instanceof Error ? r.message : String(r)),
  );
});

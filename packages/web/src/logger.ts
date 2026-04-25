// pino/browser ensures tests in node use console.* so vitest captures output.
import type {
  MapLibreMap,
  MessageType as MaplibreMessageType,
} from "maplibre-gl";
import pino from "pino/browser";

import type {
  ClientInfo,
  ClientLogEntry,
  ClientLogsPostBody,
} from "@pt/shared";

import {
  getDebugFlag,
  getDebugFlags,
  subscribeDebugFlags,
} from "@/hooks/debug-flags";

export type LogEntry = ClientLogEntry;

// --- Logger ---

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: {
    asObject: true,
    transmit: { send: pinoSend },
  },
});

export default logger;

// --- Log viewer ---

export type LogViewerState = { entries: readonly ClientLogEntry[] };

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

// --- Log shipping ---

const ENDPOINT = "/api/v1/client-logs";
export const clientID =
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
let shipQueue: ClientLogEntry[] = [];
let shipScheduled = false;

// --- Utilities ---

export function getClientInfo(): ClientInfo {
  const debugFlags = Object.entries(getDebugFlags())
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(",");

  return {
    clientID,
    clientVersion,
    clientDebugFlags: debugFlags,
    nativeVersion: window.Native?.version?.(),
    href: window.location.href,
  };
}

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

export function connectMaplibreWorkerLogs(map: MapLibreMap) {
  map.style.dispatcher.broadcast(
    "_plantopo_log_forwarder_connect" as MaplibreMessageType,
    { clientID },
  );
}

// --- Internal ---

type BaseLogEntry = Pick<ClientLogEntry, "level" | "msg" | "ts" | "extra">;

const clientVersion: string | undefined = import.meta.env.DEV
  ? "dev"
  : import.meta.env.VITE_COMMIT_HASH;

const consoleMessageMethods = [
  "log",
  "trace",
  "debug",
  "info",
  "warn",
  "error",
] as const;
type ConsoleMessageMethodName = (typeof consoleMessageMethods)[number];

// Patch console.* to forward non-pino logs into enqueue.
// pino with asObject:true calls console[method] with a single object
// { level: number, msg: string, ... } — detect and skip to avoid double-send.
//
// Skip in test mode: vitest installs its own console proxy, and wrapping it
// causes infinite recursion since target[method] routes back through ours.
//
// We define properties directly on the console object rather than replacing
// globalThis.console with a Proxy. That way console always refers to the same
// object, so fast refresh re-execution sees the already-patched methods rather
// than wrapping a proxy in another proxy. We store the native function under a
// private key on the console object itself so we can skip re-patching on
// subsequent hot reloads.
const PATCHED_KEY = "__pt_patched__";
if (import.meta.env.MODE !== "test") {
  if (!(PATCHED_KEY in console)) {
    for (const method of consoleMessageMethods) {
      const native = console[method].bind(console);
      Object.defineProperty(console, method, {
        configurable: true,
        enumerable: true,
        value: function (...args: unknown[]) {
          const entry = convertConsoleArgsToLogEntry(method, args);
          if (entry) enqueue(entry);
          return native(...args);
        },
      });
    }
    (console as unknown as Record<string, unknown>)[PATCHED_KEY] = true;
  }
}

// see public/maplibre-gl-worker-log-forwarder.js
const maplibreChannel = new BroadcastChannel("plantopo-maplibre-worker-logs");
maplibreChannel.onmessage = e => {
  const data = e.data as {
    clientID: string;
    method: ConsoleMessageMethodName;
    args: unknown[];
  };
  if (data.clientID === clientID) {
    const entry = convertConsoleArgsToLogEntry(
      data.method,
      data.args,
      "maplibre worker:",
    );
    if (entry) enqueue(entry);
  }
};

function enqueue(base: BaseLogEntry) {
  if (import.meta.env.MODE === "test") return;

  const entry: ClientLogEntry = {
    ...base,
    ...getClientInfo(),
  };

  if (entry.extra && Object.keys(entry.extra).length === 0) {
    delete entry.extra;
  }

  if (logViewerState) {
    const prev = logViewerState.entries;
    const trimmed = prev.length >= 500 ? prev.slice(1) : prev;
    logViewerState = { entries: [...trimmed, entry] };
    // Defer so logging during a React render doesn't trigger a state update in another component
    queueMicrotask(() => window.dispatchEvent(new Event(LOG_VIEWER_EVENT)));
  }

  shipQueue.push(entry);
  if (!shipScheduled) {
    shipScheduled = true;
    requestIdleCallback(shipScheduledNow, { timeout: 10_000 });
  }
}

window.addEventListener("online", () => {
  if (shipQueue.length) {
    requestIdleCallback(shipScheduledNow, { timeout: 10_000 });
  }
});

function shipScheduledNow() {
  shipScheduled = false;
  const entries = shipQueue.slice();
  if (!entries.length) return;

  const body: ClientLogsPostBody = { entries };
  const serializedBody = safeStringify(body);

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serializedBody,
  }).then(
    () => {
      const shipped = new Set(entries);
      shipQueue = shipQueue.filter(e => !shipped.has(e));
    },
    () => {},
  );
}

// Called by pino transmit for every log, independently of console output.
function pinoSend(level: pino.Level, logEvent: pino.LogEvent) {
  const entry = convertPinoEventToLogEntry(level, logEvent);
  if (entry) enqueue(entry);
}

export function convertPinoEventToLogEntry(
  level: pino.Level,
  logEvent: pino.LogEvent,
): BaseLogEntry | null {
  if (level === "trace") return null;
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
  if ("err" in extra && extra.err instanceof Error) {
    extra.err = {
      message: extra.err.message,
      name: extra.err.name,
      stack: extra.err.stack,
    };
  }
  return { level, msg, ts, extra };
}

export function convertConsoleArgsToLogEntry(
  method: ConsoleMessageMethodName,
  args: unknown[],
  messagePrefix = "",
): BaseLogEntry | null {
  if (method === "trace") return null;
  const first = args[0];
  if (
    typeof first === "object" &&
    first !== null &&
    typeof (first as Record<string, unknown>).level === "number" &&
    typeof (first as Record<string, unknown>).msg === "string"
  ) {
    // skip pino logs
    return null;
  }

  const extra: Record<string, unknown> = {};
  const parts: string[] = [];
  if (messagePrefix) parts.push(messagePrefix);

  let objIdx = 0;
  const interpolated = interpolateConsoleArgs(args);
  for (const a of interpolated) {
    if (isPlainObject(a) || Array.isArray(a)) {
      const key = `arg${objIdx++}`;
      extra[key] = sanitizeForLog(a);
      parts.push(`[${key}]`);
    } else {
      parts.push(String(a));
    }
  }

  return {
    level: method === "log" ? "info" : method,
    msg: parts.join(" "),
    ts: Date.now(),
    extra,
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

function sanitizeForLog(v: unknown, seen: Set<unknown> = new Set()): unknown {
  if (typeof v === "function") return "[Function]";
  if (isReactElement(v)) return "[ReactElement]";
  if (Array.isArray(v)) return v.map(x => sanitizeForLog(x, seen));
  if (isPlainObject(v)) {
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) out[k] = sanitizeForLog(v[k], seen);
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

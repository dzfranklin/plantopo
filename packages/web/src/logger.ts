import pino from "pino/browser";

// Using pino/browser ensures tests running in node use console.* methods
// instead of writing to stdout so vitest captures the output.

const ENDPOINT = "/api/v1/client-logs";
const windowId = crypto.randomUUID();

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

function toLevel(method: string): Level {
  return method === "log" ? "info" : (method as Level);
}

const queue: object[] = [];
let flushScheduled = false;

function flush() {
  flushScheduled = false;
  const entries = queue.splice(0);
  if (!entries.length) return;
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ windowId, entries }),
  }).catch(() => {});
}

function enqueue(entry: object) {
  if (!import.meta.env.DEV) return;
  queue.push(entry);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(flush, 0);
  }
}

// Called by pino transmit for every log, independently of console output.
function pinoSend(level: string, logEvent: pino.LogEvent) {
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
  enqueue({ level: toLevel(level), msg, time: ts, ...extra });
}

function setupForwarding() {
  // Patch console.* to forward non-pino logs.
  // pino with asObject:true calls console[method] with a single object
  // { level: number, msg: string, ... } — detect and skip to avoid double-send.
  const methods = ["log", "debug", "info", "warn", "error"] as const;
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
      enqueue({
        level: toLevel(method),
        msg: args.map(String).join(" "),
        time: Date.now(),
      });
    };
  }

  window.addEventListener("error", e => {
    enqueue({
      level: "error",
      msg: e.message,
      time: Date.now(),
      stack: e.error?.stack,
      source: `${e.filename}:${e.lineno}:${e.colno}`,
    });
  });

  window.addEventListener("unhandledrejection", e => {
    const r = e.reason;
    enqueue({
      level: "error",
      msg: r instanceof Error ? r.message : String(r),
      time: Date.now(),
      stack: r instanceof Error ? r.stack : undefined,
    });
  });
}

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: {
    asObject: true,
    ...(import.meta.env.DEV && { transmit: { send: pinoSend } }),
  },
});

if (import.meta.env.DEV) {
  setupForwarding();
}

import type pino from "pino/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let logger: typeof import("./logger").logger;
let loggerModule: typeof import("./logger");
let clientId: string;
let triggerIdleCallbacks: () => void;

type ListenerEntry = {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};
let windowListeners: ListenerEntry[] = [];

beforeEach(async () => {
  vi.resetModules();

  const origAddEventListener = window.addEventListener.bind(window);
  windowListeners = [];
  window.addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    windowListeners.push({ type, listener, options });
    origAddEventListener(type, listener, options);
  };

  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true }),
  ) as unknown as typeof fetch;

  // Reset console every time so logger doesn't wrap multiple times.
  // Stub to keep out of test output.
  global.console = {
    trace: () => {},
    debug: () => {},
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as unknown as Console;

  const idleCallbacks: IdleRequestCallback[] = [];

  global.requestIdleCallback = cb => {
    idleCallbacks.push(cb);
    return idleCallbacks.length - 1;
  };

  triggerIdleCallbacks = () => {
    while (idleCallbacks.length > 0) {
      const cb = idleCallbacks.shift()!;
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    }
  };

  class MockBroadcastChannel {
    static instances: MockBroadcastChannel[] = [];

    name: string;
    onmessage:
      | ((this: MockBroadcastChannel, ev: MessageEvent) => unknown)
      | null = null;

    constructor(name: string) {
      this.name = name;
      MockBroadcastChannel.instances.push(this);
    }

    postMessage(message: unknown) {
      for (const instance of MockBroadcastChannel.instances) {
        if (
          instance !== this &&
          instance.name === this.name &&
          instance.onmessage
        ) {
          instance.onmessage({ data: message } as MessageEvent);
        }
      }
    }

    addEventListener() {
      throw new Error("Not implemented");
    }

    close() {}
  }
  global.BroadcastChannel =
    MockBroadcastChannel as unknown as typeof BroadcastChannel;

  vi.stubEnv("MODE", "production");

  loggerModule = await import("./logger");
  logger = loggerModule.logger;
  clientId = loggerModule.clientId;
});

afterEach(() => {
  for (const { type, listener, options } of windowListeners) {
    window.removeEventListener(type, listener, options);
  }
});

it("converts pino log events to log entries", () => {
  const logEvent: pino.LogEvent = {
    level: { label: "info", value: 30 },
    ts: 1697059200000,
    messages: [{ user: "alice" }, "User logged in"],
    bindings: [{ sessionId: "abc123" }],
  };
  const entry = loggerModule.convertPinoEventToLogEntry("info", logEvent);
  expect(entry).toEqual({
    level: "info",
    msg: "User logged in",
    ts: expect.any(Number),
    extra: { user: "alice", sessionId: "abc123" },
  });
});

describe("converts console args to log entries", () => {
  it("adds prefix", () => {
    const entry = loggerModule.convertConsoleArgsToLogEntry(
      "info",
      ["Message"],
      "Prefix:",
    );
    expect(entry).toEqual(
      expect.objectContaining({
        msg: "Prefix: Message",
      }),
    );
  });

  it("stringifies non-object args", () => {
    const entry = loggerModule.convertConsoleArgsToLogEntry("info", [
      "Part 1",
      42,
      true,
    ]);
    expect(entry).toEqual(
      expect.objectContaining({
        msg: "Part 1 42 true",
      }),
    );
  });

  it("references objects in extra", () => {
    const obj = { foo: "bar" };
    const entry = loggerModule.convertConsoleArgsToLogEntry("info", [
      "Message",
      obj,
    ]);
    expect(entry).toEqual(
      expect.objectContaining({
        msg: "Message [arg0]",
        extra: { arg0: obj },
      }),
    );
  });

  it("supports circular objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const entry = loggerModule.convertConsoleArgsToLogEntry("info", [
      "Message",
      circular,
    ]);
    expect(entry).toEqual(
      expect.objectContaining({
        msg: "Message [arg0]",
        extra: { arg0: { self: "[Circular]" } },
      }),
    );
  });

  it("stringifies non-plain objects", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const entry = loggerModule.convertConsoleArgsToLogEntry("info", [
      "Message",
      date,
    ]);
    expect(entry).toEqual(
      expect.objectContaining({
        msg: expect.stringContaining("Message Mon Jan 01 2024"),
      }),
    );
  });

  it("returns null for pino log objects", () => {
    const entry = loggerModule.convertConsoleArgsToLogEntry("info", [
      { level: 30, msg: "Pino log" },
    ]);
    expect(entry).toBeNull();
  });
});

it("logger sends logs to the server", async () => {
  logger.info({ foo: "bar" }, "Test log");
  console.info("console log", ["baz", { qux: 123 }]);

  triggerIdleCallbacks();

  expect(global.fetch).toHaveBeenCalledOnce();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/v1/client-logs",
    expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: expect.stringMatching(/"Test log.*"console log/),
    }),
  );
});

it("saves entries if offline and sends them when back online", async () => {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error("Network error")),
  ) as unknown as typeof fetch;
  logger.info("Offline log");
  triggerIdleCallbacks();
  expect(global.fetch).toHaveBeenCalledTimes(1);

  window.dispatchEvent(new Event("online"));
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true }),
  ) as unknown as typeof fetch;
  triggerIdleCallbacks();
  expect(global.fetch).toHaveBeenCalledOnce();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/v1/client-logs",
    expect.objectContaining({
      body: expect.stringContaining("Offline log"),
    }),
  );
});

describe("maplibre worker log integration", () => {
  it("ignores logs for different client", async () => {
    const chan = new BroadcastChannel("plantopo-maplibre-worker-logs");
    chan.postMessage({
      clientId: "other-client",
      method: "warn",
      args: ["Worker log", 42],
    });

    triggerIdleCallbacks();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("receives logs", async () => {
    const chan = new BroadcastChannel("plantopo-maplibre-worker-logs");
    chan.postMessage({
      clientId,
      method: "warn",
      args: ["worker log", 42],
    });

    triggerIdleCallbacks();

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/client-logs",
      expect.objectContaining({
        body: expect.stringContaining('"maplibre worker: worker log 42"'),
      }),
    );
  });
});

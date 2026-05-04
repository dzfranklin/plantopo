import { type ChildProcess, fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import readline from "node:readline";

import { logger } from "../logger.js";
import type {
  ElevationResult,
  MsgFromWorker,
  MsgToWorker,
} from "./elevation.worker.js";

// NOTE: One reason elevation is implemented with a separate worker is to
// isolate the sharp dependency, which conflicts with canvas used by static map
// rendering

export type { ElevationResult } from "./elevation.worker.js";

type Pending = {
  resolve: (result: ElevationResult) => void;
  reject: (err: Error) => void;
};

let child: ChildProcess | null = null;
const pending = new Map<string, Pending>();

function ensureChild(): ChildProcess {
  if (child && !child.killed) return child;

  const workerPath = path.join(import.meta.dirname, "elevation.worker.js");
  const proc = fork(workerPath, [], {
    stdio: ["pipe", "pipe", "inherit", "ipc"],
    // Strip --inspect* flags so the worker doesn't try to bind the same debug port
    // (In dev we rely on --import=tsx/esm to transform)
    execArgv: process.execArgv.filter(arg => !arg.startsWith("--inspect")),
  });

  proc.on("exit", (code, signal) => {
    logger.error(
      { code, signal },
      "Elevation worker exited unexpectedly; rejecting all pending requests",
    );
    child = null;
    for (const [id, { reject }] of pending) {
      pending.delete(id);
      reject(
        new Error(`Elevation worker exited (code=${code} signal=${signal})`),
      );
    }
  });

  const rl = readline.createInterface({
    input: proc.stdout!,
    crlfDelay: Infinity,
  });

  rl.on("line", line => {
    let msg: MsgFromWorker;
    try {
      msg = JSON.parse(line);
    } catch {
      logger.error({ line }, "Unparseable line from elevation worker");
      return;
    }

    const entry = pending.get(msg.id);
    logger.debug(
      { type: msg.type, id: msg.id, hasEntry: !!entry },
      "Received from elevation worker",
    );
    if (!entry) return;

    pending.delete(msg.id);
    if (msg.type === "result") {
      entry.resolve(msg.result);
    } else {
      entry.reject(new Error(msg.err));
    }
  });

  child = proc;
  return proc;
}

function send(msg: MsgToWorker): void {
  const proc = ensureChild();
  proc.stdin!.write(JSON.stringify(msg) + "\n");
  logger.debug({ type: msg.type, id: msg.id }, "Sent to elevation worker");
}

export function getElevations(
  points: [number, number][],
  accessScopes: string[],
  { signal }: { signal?: AbortSignal } = {},
): Promise<ElevationResult> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    pending.set(id, { resolve, reject });

    send({ type: "start", id, points, accessScopes });

    signal?.addEventListener(
      "abort",
      () => {
        pending.delete(id);
        send({ type: "cancel", id });
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export const exportedForTesting = {
  getChild: () => child,
};

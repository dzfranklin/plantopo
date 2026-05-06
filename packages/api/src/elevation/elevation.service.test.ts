import { EventEmitter, PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MsgFromWorker } from "./elevation.worker.js";

vi.mock("node:child_process", () => ({ fork: vi.fn() }));

type ServiceModule = typeof import("./elevation.service.js");

let getElevations: ServiceModule["getElevations"];
let mockedFork: ReturnType<typeof vi.fn>;
let proc: EventEmitter & {
  killed: boolean;
  stdin: PassThrough;
  stdout: PassThrough;
};
let stdin: PassThrough;
let stdout: PassThrough;

function mockMsgFromWorker(msg: MsgFromWorker): void {
  stdout.push(JSON.stringify(msg) + "\n");
}

function readMsgSentToWorker(): Promise<any> {
  return new Promise(resolve => {
    stdin.once("data", (chunk: Buffer) =>
      resolve(JSON.parse(chunk.toString().trim())),
    );
  });
}

beforeEach(async () => {
  stdin = new PassThrough();
  stdout = new PassThrough();
  proc = Object.assign(new EventEmitter(), { killed: false, stdin, stdout });

  vi.resetModules();
  const cp = await import("node:child_process");
  mockedFork = vi.mocked(cp.fork);
  mockedFork.mockReset();
  mockedFork.mockReturnValue(proc);

  const mod = (await import("./elevation.service.js")) as ServiceModule;
  getElevations = mod.getElevations;
});

describe("getElevations", () => {
  it("forks a worker and writes a start message to stdin", async () => {
    const points: [number, number][] = [[-5.0035, 56.7969]];
    const promise = getElevations(points, []);

    const msg = await readMsgSentToWorker();
    expect(msg.type).toBe("start");
    expect(msg.points).toEqual(points);
    expect(msg.accessScopes).toEqual([]);

    mockMsgFromWorker({
      type: "result",
      id: msg.id,
      result: {
        data: [1345],
        meta: { sources: [] },
      },
    });
    expect((await promise).data).toEqual([1345]);
  });

  it("resolves with result data and meta", async () => {
    const promise = getElevations([[-5.0035, 56.7969]], ["edu"]);
    const msg = await readMsgSentToWorker();

    const meta = { sources: ["https://example.com/12/{x}/{y}.webp"] };
    mockMsgFromWorker({
      type: "result",
      id: msg.id,
      result: { data: [42.5], meta },
    });

    const res = await promise;
    expect(res.data).toEqual([42.5]);
    expect(res.meta).toEqual(meta);
  });

  it("rejects when the worker sends an error message", async () => {
    const promise = getElevations([[0, 0]], []);
    const msg = await readMsgSentToWorker();

    mockMsgFromWorker({
      type: "error",
      id: msg.id,
      err: "tile fetch failed",
    });

    await expect(promise).rejects.toThrow("tile fetch failed");
  });

  it("rejects all pending requests when the worker exits", async () => {
    const p1 = getElevations([[0, 0]], []);
    const p2 = getElevations([[1, 1]], []);

    stdin.resume();
    await new Promise(r => setImmediate(r));

    proc.emit("exit", 1, null);

    await expect(p1).rejects.toThrow("code=1");
    await expect(p2).rejects.toThrow("code=1");
  });

  it("reuses the same worker for multiple requests", async () => {
    const p1 = getElevations([[0, 0]], []);
    const p2 = getElevations([[1, 1]], []);

    const written: Array<{ id: string }> = await new Promise(resolve => {
      const chunks: Buffer[] = [];
      stdin.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        const lines = Buffer.concat(chunks)
          .toString()
          .split("\n")
          .filter(Boolean);
        if (lines.length >= 2) resolve(lines.map(l => JSON.parse(l)));
      });
    });

    for (const msg of written) {
      mockMsgFromWorker({
        type: "result",
        id: msg.id,
        result: { data: [0], meta: { sources: [] } },
      });
    }

    await Promise.all([p1, p2]);
    expect(mockedFork).toHaveBeenCalledTimes(1);
  });

  it("ignores responses with unknown ids", async () => {
    const promise = getElevations([[0, 0]], []);
    const msg = await readMsgSentToWorker();

    mockMsgFromWorker({
      type: "result",
      id: "unknown-id",
      result: { data: [999], meta: { sources: [] } },
    });
    mockMsgFromWorker({
      type: "result",
      id: msg.id,
      result: { data: [1], meta: { sources: [] } },
    });

    expect((await promise).data).toEqual([1]);
  });

  it("writes a cancel message to stdin on abort", async () => {
    const ac = new AbortController();
    const promise = getElevations([[0, 0]], [], { signal: ac.signal });

    const startMsg = await readMsgSentToWorker();

    const cancelMsgPromise = readMsgSentToWorker();
    ac.abort("some reason");
    expect(await cancelMsgPromise).toEqual({ type: "cancel", id: startMsg.id });

    await expect(promise).rejects.toBe("some reason");
  });
});

/**
 * Worker wrapper tests, in three layers:
 *  1. BatchingEmitter  - time-based flushing + cooperative cancel (pure).
 *  2. makeRunner       - drives a real solve, emits batched events, honours the
 *                        SharedArrayBuffer cancel flag.
 *  3. SolverClient     - id routing, batched delivery, done/error/cancelled,
 *                        cooperative vs hard (terminate + respawn) cancel.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BatchingEmitter, CancelledError } from "../src/worker/batching.js";
import { makeRunner } from "../src/worker/runner.js";
import { SolverClient, type WorkerLike } from "../src/worker/client.js";
import type { FromWorker } from "../src/worker/protocol.js";
import type { StepEvent } from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
function puzzles(rel: string): string[] {
  const d = readFileSync(resolve(HERE, "../../../..", rel), "utf8").replace(/[^0-9]/g, "");
  const out: string[] = [];
  for (let i = 0; i + 81 <= d.length; i += 81) out.push(d.slice(i, i + 81));
  return out;
}
const BENCH = puzzles("benchmarks/hard.txt");
const HARD = puzzles("puzzles/hard.txt");
const asg = (i: number): StepEvent => ({ type: "assign", step: i, cell: 0, value: 1, depth: 0 });

// ---- 1. BatchingEmitter --------------------------------------------------
describe("BatchingEmitter (time-based flushing)", () => {
  it("does not flush before flushMs elapses; flushes once it does", () => {
    let clock = 0;
    const batches: StepEvent[][] = [];
    const b = new BatchingEmitter(16, { now: () => clock, flush: (x) => batches.push(x) });

    for (let i = 0; i < 512; i++) b.onStep(asg(i)); // time-check fires at 256 & 512, clock still 0
    expect(batches).toHaveLength(0);
    clock = 20;
    for (let i = 512; i < 768; i++) b.onStep(asg(i)); // check at 768th -> elapsed >= 16 -> flush
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(768);
  });

  it("never posts one message per event", () => {
    let clock = 0;
    const batches: StepEvent[][] = [];
    const b = new BatchingEmitter(5, {
      now: () => (clock += 3), // 3ms per check
      flush: (x) => batches.push(x),
    });
    for (let i = 0; i < 5000; i++) b.onStep(asg(i));
    b.flushNow();
    expect(batches.length).toBeLessThan(5000 / 100);
    expect(batches.reduce((n, x) => n + x.length, 0)).toBe(5000);
  });

  it("cooperative cancel: throws CancelledError and flushes the partial batch", () => {
    let cancel = false;
    const batches: StepEvent[][] = [];
    const b = new BatchingEmitter(16, {
      now: () => 0,
      flush: (x) => batches.push(x),
      shouldCancel: () => cancel,
    });
    for (let i = 0; i < 200; i++) b.onStep(asg(i));
    cancel = true;
    expect(() => {
      for (let i = 200; i < 400; i++) b.onStep(asg(i));
    }).toThrow(CancelledError);
    expect(batches.flat()).toHaveLength(256);
  });
});

// ---- 2. makeRunner -----------------------------------------------------
describe("makeRunner (real solve, batched events)", () => {
  it("emits events batches then done", () => {
    const msgs: FromWorker[] = [];
    const { handle } = makeRunner((m) => msgs.push(m));
    handle({
      type: "solve",
      id: 1,
      puzzle: HARD[10],
      algorithm: "forward_checking",
      options: { maxSteps: 200_000 },
    });
    const kinds = msgs.map((m) => m.type);
    expect(kinds).toContain("events");
    expect(kinds[kinds.length - 1]).toBe("done");
    const done = msgs.at(-1) as Extract<FromWorker, { type: "done" }>;
    expect(done.result.solved).toBe(true);
    const eventCount = msgs
      .filter((m): m is Extract<FromWorker, { type: "events" }> => m.type === "events")
      .reduce((n, m) => n + m.batch.length, 0);
    expect(eventCount).toBeGreaterThan(0);
  });

  it("honours the SharedArrayBuffer cancel flag mid-solve", () => {
    const cancelBuf = new SharedArrayBuffer(4);
    const view = new Int32Array(cancelBuf);
    const msgs: FromWorker[] = [];
    const { handle } = makeRunner((m) => {
      msgs.push(m);
      if (m.type === "events") Atomics.store(view, 0, 1); // cancel after first batch
    });
    handle({
      type: "solve",
      id: 7,
      puzzle: BENCH[1], // 17-clue: would run to maxSteps
      algorithm: "backtracking",
      options: { maxSteps: 5_000_000, flushMs: 0, cancelBuffer: cancelBuf },
    });
    expect(msgs.at(-1)!.type).toBe("cancelled");
  });

  it("reports solver errors", () => {
    const msgs: FromWorker[] = [];
    makeRunner((m) => msgs.push(m)).handle({
      type: "solve",
      id: 3,
      puzzle: "bad",
      algorithm: "ac3",
      options: {},
    });
    expect(msgs.at(-1)!.type).toBe("error");
  });
});

// ---- 3. SolverClient (dumb mock worker) ------------------------------
class MockWorker implements WorkerLike {
  sent: unknown[] = [];
  terminated = false;
  private listeners = new Set<(ev: MessageEvent) => void>();
  postMessage(m: unknown): void {
    this.sent.push(m);
  }
  terminate(): void {
    this.terminated = true;
  }
  addEventListener(_t: "message", l: (ev: MessageEvent) => void): void {
    this.listeners.add(l);
  }
  removeEventListener(_t: "message", l: (ev: MessageEvent) => void): void {
    this.listeners.delete(l);
  }
  deliver(msg: FromWorker): void {
    for (const l of this.listeners) l({ data: msg } as MessageEvent);
  }
  lastSolveId(): number {
    const solve = [...this.sent].reverse().find((m): m is { type: "solve"; id: number } =>
      typeof m === "object" && m !== null && (m as { type?: string }).type === "solve",
    );
    return solve!.id;
  }
}

const fakeResult = {
  solution: "x".repeat(81),
  solved: true,
  runtimeMs: 1,
  nodes: 10,
  backtracks: 0,
  stepsEmitted: 0,
  algorithmName: "ac3" as const,
  terminatedReason: "solved" as const,
  seed: null,
  extra: {},
};

describe("SolverClient (message routing)", () => {
  it("posts a solve, streams batches, resolves on done", async () => {
    const mock = new MockWorker();
    const client = new SolverClient(() => mock);
    const seen: StepEvent[] = [];
    const run = client.run("0".repeat(81), "ac3", { maxSteps: 1000 }, (b) => seen.push(...b));

    const id = mock.lastSolveId();
    mock.deliver({ type: "events", id, batch: [asg(1), asg(2)] });
    mock.deliver({ type: "done", id, result: fakeResult });

    await expect(run.result).resolves.toMatchObject({ solved: true });
    expect(seen).toHaveLength(2);
  });

  it("rejects on error", async () => {
    const mock = new MockWorker();
    const client = new SolverClient(() => mock);
    const run = client.run("0".repeat(81), "ac3");
    mock.deliver({ type: "error", id: mock.lastSolveId(), message: "boom" });
    await expect(run.result).rejects.toThrow("boom");
  });

  it("cooperative cancel: sets the SAB flag, schedules a hard backstop", async () => {
    vi.useFakeTimers();
    const mock = new MockWorker();
    const client = new SolverClient(() => mock, { graceMs: 100 });
    const run = client.run("0".repeat(81), "backtracking", { maxSteps: 9_999_999 });
    const id = mock.lastSolveId();

    run.cancel();
    expect(mock.sent.some((m) => (m as { type?: string }).type === "cancel")).toBe(true);
    expect(mock.terminated).toBe(false); // grace period

    // worker acknowledges cooperatively before the backstop fires
    mock.deliver({ type: "cancelled", id, partial: { nodes: 5, backtracks: 0 } });
    await expect(run.result).rejects.toBeInstanceOf(CancelledError);

    vi.advanceTimersByTime(200);
    expect(mock.terminated).toBe(false); // backstop was cancelled
    vi.useRealTimers();
  });

  it("hard cancel: terminates and respawns the worker when the backstop fires", async () => {
    vi.useFakeTimers();
    const workers: MockWorker[] = [];
    const client = new SolverClient(() => {
      const w = new MockWorker();
      workers.push(w);
      return w;
    }, { graceMs: 50 });

    const run = client.run("0".repeat(81), "backtracking", { maxSteps: 9_999_999 });
    run.cancel();
    vi.advanceTimersByTime(60); // backstop fires

    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2); // respawned
    await expect(run.result).rejects.toBeInstanceOf(CancelledError);
    vi.useRealTimers();
    client.dispose();
  });
});

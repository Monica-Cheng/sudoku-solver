/**
 * Main-thread wrapper around the solver Web Worker.
 *
 *   const client = new SolverClient(
 *     () => new Worker(new URL("@sudoku/solver-core/worker", import.meta.url), { type: "module" }),
 *   );
 *   const run = client.run(puzzle, "ac3", { maxSteps: 200_000 }, (batch) => render(batch));
 *   const result = await run.result;   // or run.cancel()
 *
 * Cancel is cooperative when SharedArrayBuffer is available (the worker polls a
 * flag and stops mid-solve, keeping the worker reusable); otherwise, and as a
 * guaranteed backstop after `graceMs`, the worker is terminated and recreated.
 */
import { CancelledError } from "./batching.js";
import {
  CANCEL_SENTINEL,
  type FromWorker,
  type ToWorker,
  type WorkerSolveOptions,
} from "./protocol.js";
import type { SolveResult, StepEvent } from "../types.js";

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (ev: MessageEvent) => void): void;
}

export interface SolverRun {
  readonly id: number;
  readonly result: Promise<SolveResult>;
  cancel(): void;
}

interface Pending {
  resolve: (r: SolveResult) => void;
  reject: (e: unknown) => void;
  onBatch?: (batch: StepEvent[]) => void;
  cancelView: Int32Array | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
}

const HAS_SAB = typeof SharedArrayBuffer !== "undefined";

export class SolverClient {
  private worker: WorkerLike;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private readonly graceMs: number;
  private disposed = false;

  constructor(
    private readonly workerFactory: () => WorkerLike,
    opts: { graceMs?: number } = {},
  ) {
    this.graceMs = opts.graceMs ?? 150;
    this.worker = this.spawn();
  }

  private spawn(): WorkerLike {
    const w = this.workerFactory();
    w.addEventListener("message", this.onMessage);
    return w;
  }

  private readonly onMessage = (ev: MessageEvent): void => {
    const msg = ev.data as FromWorker;
    const p = this.pending.get(msg.id);
    if (!p || p.settled) return;
    switch (msg.type) {
      case "events":
        p.onBatch?.(msg.batch);
        break;
      case "done":
        this.settle(msg.id, () => p.resolve(msg.result));
        break;
      case "error":
        this.settle(msg.id, () => p.reject(new Error(msg.message)));
        break;
      case "cancelled":
        this.settle(msg.id, () => p.reject(new CancelledError()));
        break;
    }
  };

  private settle(id: number, run: () => void): void {
    const p = this.pending.get(id);
    if (!p || p.settled) return;
    p.settled = true;
    if (p.graceTimer) clearTimeout(p.graceTimer);
    this.pending.delete(id);
    run();
  }

  run(
    puzzle: string,
    algorithm: string,
    options: Omit<WorkerSolveOptions, "cancelBuffer"> = {},
    onBatch?: (batch: StepEvent[]) => void,
  ): SolverRun {
    if (this.disposed) throw new Error("SolverClient disposed");
    const id = this.nextId++;
    const cancelView = HAS_SAB ? new Int32Array(new SharedArrayBuffer(4)) : null;

    const result = new Promise<SolveResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        onBatch,
        cancelView,
        graceTimer: null,
        settled: false,
      });
    });

    const msg: ToWorker = {
      type: "solve",
      id,
      puzzle,
      algorithm,
      options: { ...options, cancelBuffer: cancelView?.buffer as SharedArrayBuffer | undefined },
    };
    this.worker.postMessage(msg);

    return { id, result, cancel: () => this.cancel(id) };
  }

  cancel(id: number): void {
    const p = this.pending.get(id);
    if (!p || p.settled) return;

    // best-effort message (only helps if the worker isn't mid-solve)
    this.worker.postMessage({ type: "cancel", id } satisfies ToWorker);

    if (p.cancelView) {
      Atomics.store(p.cancelView, 0, CANCEL_SENTINEL);
      p.graceTimer = setTimeout(() => this.hardCancel(id), this.graceMs);
    } else {
      this.hardCancel(id);
    }
  }

  /** Terminate the worker (guaranteed stop) and recreate it for reuse. */
  private hardCancel(id: number): void {
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.terminate();

    const rejecting = [...this.pending.entries()];
    this.pending.clear();
    if (!this.disposed) this.worker = this.spawn();

    for (const [pid, p] of rejecting) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      p.settled = true;
      p.reject(pid === id ? new CancelledError() : new CancelledError());
    }
  }

  dispose(): void {
    this.disposed = true;
    this.hardCancel(-1);
  }
}

/** One-shot convenience: fresh worker, run, dispose. */
export async function solveInWorker(
  workerFactory: () => WorkerLike,
  puzzle: string,
  algorithm: string,
  options: Omit<WorkerSolveOptions, "cancelBuffer"> = {},
  onBatch?: (batch: StepEvent[]) => void,
): Promise<SolveResult> {
  const client = new SolverClient(workerFactory);
  try {
    return await client.run(puzzle, algorithm, options, onBatch).result;
  } finally {
    client.dispose();
  }
}

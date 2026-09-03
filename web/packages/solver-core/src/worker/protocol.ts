/** Message protocol between the main thread and the solver Web Worker. */
import type { SolveResult, StepEvent } from "../types.js";

export interface WorkerSolveOptions {
  seed?: number;
  maxSteps?: number;
  maxEvents?: number;
  /** Flush the event buffer to the main thread at most this often (ms). Default 16. */
  flushMs?: number;
  /**
   * Optional cooperative-cancel channel. Int32Array(1) over a SharedArrayBuffer;
   * the main thread sets [0]=1 to ask the worker to stop mid-solve. Only usable
   * where SharedArrayBuffer is available (cross-origin isolated pages / Node).
   */
  cancelBuffer?: SharedArrayBuffer;
}

export type ToWorker =
  | {
      type: "solve";
      id: number;
      puzzle: string;
      algorithm: string;
      options: WorkerSolveOptions;
    }
  | { type: "cancel"; id: number };

export type FromWorker =
  | { type: "events"; id: number; batch: StepEvent[] }
  | { type: "done"; id: number; result: SolveResult }
  | { type: "cancelled"; id: number; partial: Pick<SolveResult, "nodes" | "backtracks"> }
  | { type: "error"; id: number; message: string };

export const CANCEL_SENTINEL = 1;

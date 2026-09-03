/**
 * Web Worker helpers - the main-thread API.
 *
 *   import { SolverClient } from "@sudoku/solver-core/worker";
 *   new SolverClient(() =>
 *     new Worker(new URL("@sudoku/solver-core/worker-entry", import.meta.url), { type: "module" }),
 *   );
 *
 * `@sudoku/solver-core/worker-entry` is the Worker script itself.
 */
export { SolverClient, solveInWorker, type WorkerLike, type SolverRun } from "./client.js";
export { BatchingEmitter, CancelledError } from "./batching.js";
export type { WorkerSolveOptions, ToWorker, FromWorker } from "./protocol.js";

/**
 * Web Worker entry point.
 *
 *   new Worker(new URL("@sudoku/solver-core/worker-entry", import.meta.url), { type: "module" })
 *
 * See SolverClient (`@sudoku/solver-core/worker`) for the main-thread side.
 */
/// <reference lib="webworker" />
import { makeRunner } from "./runner.js";
import type { ToWorker } from "./protocol.js";

declare const self: DedicatedWorkerGlobalScope;

const runner = makeRunner((msg) => self.postMessage(msg));
self.onmessage = (e: MessageEvent<ToWorker>) => runner.handle(e.data);

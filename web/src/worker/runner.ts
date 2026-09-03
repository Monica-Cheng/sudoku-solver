/**
 * Transport-agnostic "run one solve, stream batched events" job runner. Shared
 * by solverWorker.ts (real Web Worker) and the worker tests (fake worker), so
 * the batching / cancel logic is exercised without a real Worker.
 */
import { solve } from "../index.js";
import { BatchingEmitter, CancelledError } from "./batching.js";
import { CANCEL_SENTINEL, type FromWorker, type ToWorker } from "./protocol.js";

export function makeRunner(
  post: (msg: FromWorker) => void,
  now: () => number = () => performance.now(),
): { handle: (msg: ToWorker) => void } {
  let activeId: number | null = null;
  let messageCancel = false;
  let nodesSoFar = 0;

  function handle(msg: ToWorker): void {
    if (msg.type === "cancel") {
      if (msg.id === activeId) messageCancel = true;
      return;
    }
    if (msg.type !== "solve") return;

    const { id, puzzle, algorithm, options } = msg;
    activeId = id;
    messageCancel = false;
    nodesSoFar = 0;

    const cancelView = options.cancelBuffer ? new Int32Array(options.cancelBuffer) : null;
    const emitter = new BatchingEmitter(options.flushMs ?? 16, {
      now,
      flush: (batch) => post({ type: "events", id, batch }),
      shouldCancel: () =>
        messageCancel ||
        (cancelView !== null && Atomics.load(cancelView, 0) === CANCEL_SENTINEL),
    });

    try {
      const result = solve(puzzle, algorithm, {
        seed: options.seed,
        maxSteps: options.maxSteps,
        maxEvents: options.maxEvents,
        onStep: (ev) => {
          if (ev.type === "assign" || ev.type === "conflicts") nodesSoFar = ev.step;
          emitter.onStep(ev);
        },
      });
      emitter.flushNow();
      post({ type: "done", id, result });
    } catch (err) {
      emitter.flushNow();
      if (err instanceof CancelledError) {
        post({ type: "cancelled", id, partial: { nodes: nodesSoFar, backtracks: 0 } });
      } else {
        post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      activeId = null;
    }
  }

  return { handle };
}

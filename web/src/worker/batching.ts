/**
 * Time-based event batching for the worker.
 *
 * `solve()` is synchronous, so a timer can't fire while it runs - flushing is
 * instead driven by polling wall-clock time inside the onStep callback. A flush
 * happens when at least `flushMs` have elapsed since the previous one (checked
 * every 256 events so `performance.now()` isn't called on the hot path). This
 * keeps the main thread responsive on fast solves (one flush at the end) and
 * bounded-latency on slow ones (a flush every `flushMs`), without ever posting
 * a message per event.
 *
 * Pure and framework-free so it can be unit-tested without a real Worker.
 */
import type { StepEvent } from "../types.js";

const CHECK_MASK = 0xff; // poll time / cancel every 256 events

export interface BatcherHooks {
  now: () => number;
  flush: (batch: StepEvent[]) => void;
  /** Return true to abort the solve (checked on the same cadence as flush). */
  shouldCancel?: () => boolean;
}

export class CancelledError extends Error {
  constructor() {
    super("solve cancelled");
    this.name = "CancelledError";
  }
}

export class BatchingEmitter {
  private buffer: StepEvent[] = [];
  private lastFlush: number;
  private seen = 0;

  constructor(
    private readonly flushMs: number,
    private readonly hooks: BatcherHooks,
  ) {
    this.lastFlush = hooks.now();
  }

  /** Pass this as `onStep`. */
  readonly onStep = (ev: StepEvent): void => {
    this.buffer.push(ev);
    if ((++this.seen & CHECK_MASK) !== 0) return;
    if (this.hooks.shouldCancel?.()) {
      this.flushNow();
      throw new CancelledError();
    }
    const now = this.hooks.now();
    if (now - this.lastFlush >= this.flushMs) {
      this.flushNow(now);
    }
  };

  /** Flush any buffered events (call once after solve returns / on cancel). */
  flushNow(now?: number): void {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    this.lastFlush = now ?? this.hooks.now();
    this.hooks.flush(batch);
  }
}

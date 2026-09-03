/**
 * Port of solvers/sampler.py::StepSampler.
 *
 * Forwards an evenly-spaced subset of events to `onStep`:
 *   stride = max(1, ceil(workBudget / maxEvents)),  workBudget = maxSteps or 1e6
 * A primary tick is sampled iff `tick % stride === 0`; all sub-events of a
 * sampled tick are forwarded. Lifecycle events always pass and don't count
 * toward maxEvents. Once maxEvents non-lifecycle events are delivered, further
 * non-lifecycle events are dropped.
 */
import { LIFECYCLE_TYPES, type StepEvent } from "./types.js";

const DEFAULT_WORK_BUDGET = 1_000_000;

export class StepSampler {
  private readonly onStep: (ev: StepEvent) => void;
  private readonly maxEvents: number | undefined;
  private readonly stride: number;
  private tickCount = 0;
  private tickLive = true;
  private deliveredCount = 0;
  private stopped = false;

  constructor(
    onStep: (ev: StepEvent) => void,
    maxEvents?: number,
    maxSteps?: number,
  ) {
    this.onStep = onStep;
    this.maxEvents = maxEvents;
    const budget = maxSteps && maxSteps > 0 ? maxSteps : DEFAULT_WORK_BUDGET;
    this.stride =
      maxEvents === undefined || maxEvents <= 0
        ? 1
        : Math.max(1, Math.ceil(budget / maxEvents));
  }

  /** Once per primary step (search node / iteration / arc revision). */
  tick(): number {
    this.tickCount += 1;
    this.tickLive = this.tickCount % this.stride === 0;
    return this.tickCount;
  }

  get step(): number {
    return this.tickCount;
  }
  get delivered(): number {
    return this.deliveredCount;
  }

  /** Build and (maybe) forward an event. `fields` excludes `type` and `step`. */
  emit(type: StepEvent["type"], fields: Record<string, unknown> = {}): void {
    const isLifecycle = LIFECYCLE_TYPES.has(type);
    if (!isLifecycle) {
      if (this.stopped || !this.tickLive) return;
      if (this.maxEvents !== undefined && this.deliveredCount >= this.maxEvents) {
        this.stopped = true;
        return;
      }
    }
    const ev = { type, step: this.tickCount, ...fields } as unknown as StepEvent;
    if (!isLifecycle) this.deliveredCount += 1;
    this.onStep(ev);
  }
}

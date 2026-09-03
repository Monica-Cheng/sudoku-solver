/**
 * Mirrors solvers/base.py (SolveResult) and solvers/events.py (event schema).
 * Event objects use the exact key names the Python side emits (including
 * snake_case `cell_a`, `queue_size`, ...) so a single renderer can consume
 * either backend. See solvers/EVENT_SCHEMA.md.
 */

export type TerminatedReason = "solved" | "exhausted" | "no_solution" | "max_steps";
export const TERMINATED_REASONS: readonly TerminatedReason[] = [
  "solved",
  "exhausted",
  "no_solution",
  "max_steps",
];

export type AlgorithmName =
  | "backtracking"
  | "forward_checking"
  | "ac3"
  | "min_conflicts";

// ---- step events -----------------------------------------------------------

interface Base {
  step: number;
}

export interface AssignEvent extends Base {
  type: "assign";
  cell: number;
  value: number;
  depth: number;
}
export interface UnassignEvent extends Base {
  type: "unassign";
  cell: number;
  value: number;
  depth: number;
}
export interface EliminateEvent extends Base {
  type: "eliminate";
  cell: number;
  value: number;
  by: number | null;
}
export interface RestoreEvent extends Base {
  type: "restore";
  cell: number;
  value: number;
  by: number | null;
}
export interface Ac3ReviseEvent extends Base {
  type: "ac3_revise";
  arc: [number, number];
  removed: number[];
  queue_size: number;
}
export interface SwapEvent extends Base {
  type: "swap";
  cell_a: number;
  cell_b: number;
  value_a: number;
  value_b: number;
}
export interface ReassignEvent extends Base {
  type: "reassign";
  cell: number;
  value: number;
  previous: number;
}
export interface ConflictsEvent extends Base {
  type: "conflicts";
  count: number;
  iteration: number;
}
export interface StartEvent extends Base {
  type: "start";
  algorithm: AlgorithmName;
  givens: string;
}
export interface PhaseEvent extends Base {
  type: "phase";
  name: string;
}
export interface SolvedEvent extends Base {
  type: "solved";
  solution: string;
}
export interface StoppedEvent extends Base {
  type: "stopped";
  reason: Exclude<TerminatedReason, "solved">;
}

export type StepEvent =
  | AssignEvent
  | UnassignEvent
  | EliminateEvent
  | RestoreEvent
  | Ac3ReviseEvent
  | SwapEvent
  | ReassignEvent
  | ConflictsEvent
  | StartEvent
  | PhaseEvent
  | SolvedEvent
  | StoppedEvent;

export const LIFECYCLE_TYPES: ReadonlySet<StepEvent["type"]> = new Set([
  "start",
  "phase",
  "solved",
  "stopped",
]);

// ---- solve() contract -----------------------------------------------------

export interface SolveOptions {
  /** Receives step events. Omit for near-zero overhead. */
  onStep?: (event: StepEvent) => void;
  /** Only meaningful for min_conflicts; ignored by the deterministic solvers. */
  seed?: number;
  /** Cap on primary work (nodes / iterations). Hitting it -> "max_steps". */
  maxSteps?: number;
  /** Cap on events delivered to onStep (evenly sampled). Needs onStep. */
  maxEvents?: number;
}

export interface SolveResult {
  solution: string | null;
  solved: boolean;
  runtimeMs: number;
  nodes: number;
  backtracks: number;
  stepsEmitted: number;
  algorithmName: AlgorithmName;
  terminatedReason: TerminatedReason;
  seed: number | null;
  extra: Record<string, unknown>;
}

import type { StepEvent, AlgorithmName, TerminatedReason } from "@sudoku/solver-core";

export const CellStatus = {
  Idle: 0,
  Given: 1,
  Trying: 2,
  Solved: 3,
} as const;
export type CellStatusValue = (typeof CellStatus)[keyof typeof CellStatus];

const ALL_CANDS = 0b1_1111_1111; // bits 0..8 -> digits 1..9

/**
 * Mutable per-grid visual model. Events mutate it in place; the renderer reads
 * a snapshot on each animation frame. This is where solvers/EVENT_SCHEMA.md is
 * mapped to visual treatment:
 *
 *   assign     -> fill cell, mark "trying"
 *   unassign   -> clear cell, red flash
 *   eliminate  -> dim a candidate
 *   restore    -> un-dim a candidate
 *   ac3_revise -> pulse both arc cells
 *   swap       -> trade two values, pulse both
 *   reassign   -> set value, flash
 *   conflicts  -> update the conflict counter
 *   solved     -> every non-given cell to the accent "solved" state
 *
 * backtracking emits only assign/unassign, so it renders with no pencil marks
 * and no pulses -- it visibly looks like blind guessing. That contrast is the
 * point; nothing is added to compensate.
 */
export class GridModel {
  readonly algorithm: AlgorithmName;
  readonly givens: Uint8Array;         // 1 where the puzzle fixed a value
  values: Uint8Array;                  // 0 = blank, 1..9
  status: Uint8Array;                  // CellStatus
  cands: Uint16Array;                  // bitmask of remaining candidates
  flashUntil: Float64Array;            // ms timestamp for the fail flash
  pulseUntil: Float64Array;            // ms timestamp for the arc / swap pulse

  step = 0;                            // latest event.step (true ordinal)
  nodes = 0;                           // live proxy (assign count); exact after done
  backtracks = 0;                      // live proxy (unassign count); exact after done
  conflicts: number | null = null;    // min-conflicts only
  phase: string | null = null;
  solved = false;
  terminated: TerminatedReason | null = null;
  version = 0;                         // bump so React knows to re-read

  constructor(puzzle: string, algorithm: AlgorithmName) {
    this.algorithm = algorithm;
    this.givens = new Uint8Array(81);
    this.values = new Uint8Array(81);
    this.status = new Uint8Array(81);
    this.cands = new Uint16Array(81);
    this.flashUntil = new Float64Array(81);
    this.pulseUntil = new Float64Array(81);

    const tracksDomains = algorithm === "forward_checking" || algorithm === "ac3";
    for (let i = 0; i < 81; i++) {
      const d = puzzle.charCodeAt(i) - 48;
      if (d >= 1 && d <= 9) {
        this.givens[i] = 1;
        this.values[i] = d;
        this.status[i] = CellStatus.Given;
      } else if (tracksDomains) {
        this.cands[i] = ALL_CANDS;
      }
    }
  }

  apply(ev: StepEvent, now: number): void {
    switch (ev.type) {
      case "start":
        this.phase = null;
        break;
      case "phase":
        this.phase = ev.name;
        break;
      case "assign": {
        this.values[ev.cell] = ev.value;
        this.status[ev.cell] = CellStatus.Trying;
        this.nodes++;
        break;
      }
      case "unassign": {
        this.values[ev.cell] = 0;
        this.status[ev.cell] = CellStatus.Idle;
        this.flashUntil[ev.cell] = now + 320;
        this.backtracks++;
        break;
      }
      case "eliminate":
        this.cands[ev.cell] &= ~(1 << (ev.value - 1));
        break;
      case "restore":
        this.cands[ev.cell] |= 1 << (ev.value - 1);
        break;
      case "ac3_revise":
        this.pulseUntil[ev.arc[0]] = now + 260;
        this.pulseUntil[ev.arc[1]] = now + 260;
        break;
      case "swap": {
        this.values[ev.cell_a] = ev.value_b;
        this.values[ev.cell_b] = ev.value_a;
        this.pulseUntil[ev.cell_a] = now + 260;
        this.pulseUntil[ev.cell_b] = now + 260;
        break;
      }
      case "reassign": {
        this.values[ev.cell] = ev.value;
        this.flashUntil[ev.cell] = now + 220;
        break;
      }
      case "conflicts":
        this.conflicts = ev.count;
        break;
      case "solved": {
        for (let i = 0; i < 81; i++) {
          if (this.givens[i]) continue;
          this.values[i] = ev.solution.charCodeAt(i) - 48;
          this.status[i] = CellStatus.Solved;
        }
        this.solved = true;
        break;
      }
      case "stopped":
        this.terminated = ev.reason;
        break;
    }
    if ("step" in ev) this.step = ev.step;
    this.version++;
  }

  /** call once the SolveResult is known to replace the live proxies */
  finalize(result: { nodes: number; backtracks: number; terminatedReason: TerminatedReason }) {
    this.nodes = result.nodes;
    this.backtracks = result.backtracks;
    this.terminated = result.terminatedReason;
    this.version++;
  }
}

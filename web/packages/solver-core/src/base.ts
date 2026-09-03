/** Mirrors solvers/base.py: puzzle validation, SolveResult assembly, a
 * tracemalloc-free timer. */
import { StepSampler } from "./sampler.js";
import type {
  AlgorithmName,
  SolveResult,
  StepEvent,
  TerminatedReason,
} from "./types.js";

export const PUZZLE_LEN = 81;
const DIGITS_SET = new Set("123456789");

export function normalizePuzzle(puzzle: string): string {
  if (typeof puzzle !== "string") throw new TypeError("puzzle must be a string");
  const p = puzzle.trim().replace(/\./g, "0");
  if (p.length !== PUZZLE_LEN || /[^0-9]/.test(p)) {
    throw new Error(`puzzle must be ${PUZZLE_LEN} chars of 0-9/., got ${p.length}`);
  }
  return p;
}

export function isSolvedString(s: string | null): boolean {
  if (!s || s.length !== PUZZLE_LEN || s.includes("0")) return false;
  const g: string[] = [];
  for (let i = 0; i < 81; i += 9) g.push(s.slice(i, i + 9));
  const eq = (chars: string[]) =>
    chars.length === 9 && new Set(chars).size === 9 && chars.every((c) => DIGITS_SET.has(c));
  for (let i = 0; i < 9; i++) {
    if (!eq([...g[i]])) return false;
    if (!eq(Array.from({ length: 9 }, (_, r) => g[r][i]))) return false;
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const box: string[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box.push(g[br + i][bc + j]);
      if (!eq(box)) return false;
    }
  }
  return true;
}

export function makeSampler(
  onStep: ((ev: StepEvent) => void) | undefined,
  maxEvents: number | undefined,
  maxSteps: number | undefined,
): StepSampler | null {
  return onStep === undefined ? null : new StepSampler(onStep, maxEvents, maxSteps);
}

export interface CoreResult {
  solution: string | null;
  solved: boolean;
  nodes: number;
  backtracks: number;
  reason: TerminatedReason;
  extra?: Record<string, unknown>;
}

export function finish(
  core: CoreResult,
  algorithmName: AlgorithmName,
  runtimeMs: number,
  sampler: StepSampler | null,
  seed: number | null = null,
): SolveResult {
  return {
    solution: core.solution,
    solved: core.solved,
    runtimeMs,
    nodes: core.nodes,
    backtracks: core.backtracks,
    stepsEmitted: sampler ? sampler.delivered : 0,
    algorithmName,
    terminatedReason: core.reason,
    seed,
    extra: core.extra ?? {},
  };
}

export function timed<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const result = fn();
  return [result, performance.now() - t0];
}

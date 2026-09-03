/**
 * @sudoku/solver-core - zero-dependency TypeScript port of the four solvers.
 * Usable unchanged from a Web Worker, a Node script, or a React app.
 *
 *   import { solve, SOLVERS } from "@sudoku/solver-core";
 *   const r = solve(puzzle, "ac3", { maxSteps: 100_000 });
 */
export type {
  AlgorithmName,
  SolveOptions,
  SolveResult,
  StepEvent,
  TerminatedReason,
} from "./types.js";
export { TERMINATED_REASONS, LIFECYCLE_TYPES } from "./types.js";
export { normalizePuzzle, isSolvedString } from "./base.js";
export { isValidEvent, EVENT_TYPES } from "./events.js";
export { MT19937 } from "./rng/mt19937.js";

import type { SolveOptions, SolveResult } from "./types.js";
import { solve as backtracking } from "./solvers/backtracking.js";
import { solve as forwardChecking } from "./solvers/forwardChecking.js";
import { solve as ac3 } from "./solvers/ac3/index.js";
import { solve as minConflicts } from "./solvers/minConflicts.js";

export const SOLVERS = {
  backtracking,
  forward_checking: forwardChecking,
  ac3,
  min_conflicts: minConflicts,
} as const;

export type SolverName = keyof typeof SOLVERS;

const ALIASES: Record<string, SolverName> = {
  algo1: "backtracking",
  bt: "backtracking",
  algo2: "forward_checking",
  fc: "forward_checking",
  algo3: "ac3",
  algo4: "min_conflicts",
  mc: "min_conflicts",
  "min-conflicts": "min_conflicts",
};

export function solve(
  puzzle: string,
  algorithm: string,
  options: SolveOptions = {},
): SolveResult {
  const key = (ALIASES[algorithm] ?? algorithm) as SolverName;
  const fn = SOLVERS[key];
  if (!fn) {
    throw new Error(
      `unknown algorithm ${JSON.stringify(algorithm)}; choose from ${Object.keys(SOLVERS).join(", ")}`,
    );
  }
  return fn(puzzle, options);
}

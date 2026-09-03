/**
 * Algo4 - min-conflicts local search. Literal port of
 * solvers/min_conflicts/core.py. The Python `random.Random(seed)` is replaced
 * by the CPython-compatible MT19937 in ../rng/mt19937, so a given seed
 * reproduces the Python run exactly (shuffle / choice call sequence is
 * identical).
 */
import { finish, makeSampler, normalizePuzzle, timed } from "../base.js";
import type { CoreResult } from "../base.js";
import { MT19937 } from "../rng/mt19937.js";
import type { StepSampler } from "../sampler.js";
import type { SolveOptions, SolveResult } from "../types.js";

export const ALGORITHM_NAME = "min_conflicts" as const;
export const DEFAULT_MAX_STEPS = 200_000;
const N = 9;

function getConflicts(board: number[][], row: number, col: number, val: number): number {
  let conflicts = 0;
  for (let k = 0; k < N; k++) if (k !== col && board[row][k] === val) conflicts += 1;
  for (let k = 0; k < N; k++) if (k !== row && board[k][col] === val) conflicts += 1;
  const startRow = 3 * Math.floor(row / 3);
  const startCol = 3 * Math.floor(col / 3);
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      if ((r !== row || c !== col) && board[r][c] === val) conflicts += 1;
    }
  }
  return conflicts;
}

function randomInitialBoard(puzzle: number[][], rng: MT19937): number[][] {
  const board = puzzle.map((row) => row.slice());
  for (let i = 0; i < N; i++) {
    const present = board[i].filter((x) => x !== 0);
    const missing: number[] = [];
    for (let n = 1; n < 10; n++) if (!present.includes(n)) missing.push(n);
    rng.shuffle(missing);
    let midx = 0;
    for (let j = 0; j < N; j++) {
      if (board[i][j] === 0) board[i][j] = missing[midx++];
    }
  }
  return board;
}

function conflictedCells(board: number[][], fixed: boolean[][]): [number, number][] {
  const cells: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (!fixed[i][j] && getConflicts(board, i, j, board[i][j]) > 0) cells.push([i, j]);
    }
  }
  return cells;
}

function totalConflictsForSwap(
  board: number[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): number {
  const v1 = board[r1][c1];
  const v2 = board[r2][c2];
  return getConflicts(board, r1, c1, v2) + getConflicts(board, r2, c2, v1);
}

function parse(puzzle: string): number[][] {
  const g: number[][] = [];
  for (let i = 0; i < 81; i += 9) g.push([...puzzle.slice(i, i + 9)].map(Number));
  return g;
}

function search(
  puzzle: string,
  sampler: StepSampler | null,
  maxSteps: number | undefined,
  seed: number | undefined,
): CoreResult & { usedSeed: number } {
  const steps = maxSteps ?? DEFAULT_MAX_STEPS;
  const usedSeed = seed ?? Math.floor(Math.random() * 0x100000000);
  const rng = new MT19937(usedSeed);

  const grid = parse(puzzle);
  const fixed = grid.map((row) => row.map((v) => v !== 0));
  if (sampler) sampler.emit("start", { algorithm: ALGORITHM_NAME, givens: puzzle });
  const board = randomInitialBoard(grid, rng);

  let nodes = 0;
  let backtracks = 0;
  let reason: CoreResult["reason"] = "max_steps";

  for (let step = 0; step < steps; step++) {
    nodes += 1;
    if (sampler) sampler.tick();

    const conflicted = conflictedCells(board, fixed);
    if (sampler) sampler.emit("conflicts", { count: conflicted.length, iteration: step });
    if (conflicted.length === 0) {
      reason = "solved";
      break;
    }

    const [row, col] = rng.choice(conflicted);

    let bestSwap: number | null = null;
    let bestConf: number | null = null;
    for (let j = 0; j < N; j++) {
      if (j === col || fixed[row][j]) continue;
      const conf = totalConflictsForSwap(board, row, col, row, j);
      if (bestConf === null || conf < bestConf) {
        bestConf = conf;
        bestSwap = j;
      }
    }

    if (bestSwap !== null) {
      const va = board[row][col];
      const vb = board[row][bestSwap];
      board[row][col] = vb;
      board[row][bestSwap] = va;
      if (sampler) {
        sampler.emit("swap", {
          cell_a: row * 9 + col,
          cell_b: row * 9 + bestSwap,
          value_a: va,
          value_b: vb,
        });
      }
    } else {
      backtracks += 1;
      let minConf = Infinity;
      let bestVals: number[] = [];
      for (let val = 1; val < 10; val++) {
        const c = getConflicts(board, row, col, val);
        if (c < minConf) {
          minConf = c;
          bestVals = [val];
        } else if (c === minConf) {
          bestVals.push(val);
        }
      }
      const prev = board[row][col];
      board[row][col] = rng.choice(bestVals);
      if (sampler) {
        sampler.emit("reassign", { cell: row * 9 + col, value: board[row][col], previous: prev });
      }
    }
  }

  const solution =
    reason === "solved" ? board.map((r) => r.join("")).join("") : null;
  if (sampler) {
    if (reason === "solved") sampler.emit("solved", { solution });
    else sampler.emit("stopped", { reason });
  }
  return { solution, solved: reason === "solved", nodes, backtracks, reason, usedSeed };
}

export function solve(puzzle: string, options: SolveOptions = {}): SolveResult {
  const p = normalizePuzzle(puzzle);
  const budget = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const sampler = makeSampler(options.onStep, options.maxEvents, budget);
  const [result, ms] = timed(() => search(p, sampler, options.maxSteps, options.seed));
  return finish(result, ALGORITHM_NAME, ms, sampler, result.usedSeed);
}

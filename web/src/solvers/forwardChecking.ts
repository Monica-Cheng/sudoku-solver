/**
 * Algo2 - backtracking + forward checking + MRV. Literal port of
 * solvers/forward_checking/core.py: domain lists that drift as values are
 * removed / re-appended on backtrack, MRV variable order (ties -> earliest),
 * per-cell forward check for emptiness, one node per cell visited.
 */
import { finish, makeSampler, normalizePuzzle, timed } from "../base.js";
import type { CoreResult } from "../base.js";
import type { SolveOptions, SolveResult } from "../types.js";
import type { StepSampler } from "../sampler.js";
import { SudokuBoard } from "./board.js";

export const ALGORITHM_NAME = "forward_checking" as const;

type Emit = ((type: "eliminate" | "restore", fields: Record<string, unknown>) => void) | null;
type Domains = number[][][]; // [9][9][k]

class BudgetHit extends Error {}

function setDomains(board: SudokuBoard): Domains {
  const domains: Domains = [];
  for (let i = 0; i < 9; i++) {
    const row: number[][] = [];
    for (let j = 0; j < 9; j++) row.push([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    domains.push(row);
  }
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const val = board.board[i][j];
      if (val !== 0) {
        domains[i][j] = [-1];
        constrictDomains(board, i, j, val, domains, null, null);
      }
    }
  }
  return domains;
}

function remove(arr: number[], x: number): void {
  const k = arr.indexOf(x);
  if (k !== -1) arr.splice(k, 1);
}

function constrictDomains(
  board: SudokuBoard,
  row: number,
  col: number,
  num: number,
  domains: Domains,
  emit: Emit,
  by: number | null,
): void {
  const boxX = Math.floor(col / 3);
  const boxY = Math.floor(row / 3);
  for (let i = boxY * 3; i < boxY * 3 + 3; i++) {
    for (let j = boxX * 3; j < boxX * 3 + 3; j++) {
      if (domains[i][j].includes(num) && board.board[i][j] === 0) {
        remove(domains[i][j], num);
        if (emit) emit("eliminate", { cell: i * 9 + j, value: num, by });
      }
    }
  }
  for (let j = 0; j < 9; j++) {
    if (domains[row][j].includes(num) && board.board[row][j] === 0) {
      remove(domains[row][j], num);
      if (emit) emit("eliminate", { cell: row * 9 + j, value: num, by });
    }
  }
  for (let i = 0; i < 9; i++) {
    if (domains[i][col].includes(num) && board.board[i][col] === 0) {
      remove(domains[i][col], num);
      if (emit) emit("eliminate", { cell: i * 9 + col, value: num, by });
    }
  }
}

function repairDomains(
  board: SudokuBoard,
  row: number,
  col: number,
  num: number,
  domains: Domains,
  emit: Emit,
): void {
  const boxX = Math.floor(col / 3);
  const boxY = Math.floor(row / 3);
  for (let i = boxY * 3; i < boxY * 3 + 3; i++) {
    for (let j = boxX * 3; j < boxX * 3 + 3; j++) {
      if (board.validInput(i, j, num) && !domains[i][j].includes(num)) {
        domains[i][j].push(num);
        if (emit) emit("restore", { cell: i * 9 + j, value: num, by: null });
      }
    }
  }
  for (let j = 0; j < 9; j++) {
    if (board.validInput(row, j, num) && !domains[row][j].includes(num)) {
      domains[row][j].push(num);
      if (emit) emit("restore", { cell: row * 9 + j, value: num, by: null });
    }
  }
  for (let i = 0; i < 9; i++) {
    if (board.validInput(i, col, num) && !domains[i][col].includes(num)) {
      domains[i][col].push(num);
      if (emit) emit("restore", { cell: i * 9 + col, value: num, by: null });
    }
  }
}

function emptyDomain(board: SudokuBoard, domains: Domains): boolean {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board.board[i][j] === 0 && domains[i][j].length === 0) return true;
    }
  }
  return false;
}

function minimumRemainingValues(board: SudokuBoard, domains: Domains): [number, number] | null {
  let mrv: [number, number] | null = null;
  let minLen = 10;
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (board.board[i][j] === 0 && domains[i][j].length < minLen) {
        mrv = [i, j];
        minLen = domains[i][j].length;
      }
    }
  }
  return mrv;
}

class Runner {
  board: SudokuBoard;
  private sampler: StepSampler | null;
  private emit: Emit;
  private cap: number | undefined;
  private budgeted: boolean;

  constructor(board: SudokuBoard, sampler: StepSampler | null, maxSteps: number | undefined) {
    this.board = board;
    this.sampler = sampler;
    this.emit = sampler
      ? (t, f) => sampler.emit(t, f)
      : null;
    this.cap = maxSteps;
    this.budgeted = maxSteps !== undefined;
  }

  rec(domains: Domains, depth = 0): boolean {
    const nxt = minimumRemainingValues(this.board, domains);
    if (!nxt) return true;
    const [row, col] = nxt;

    this.board.uniqueStates += 1;
    if (this.budgeted && this.board.uniqueStates > this.cap!) {
      this.board.uniqueStates -= 1;
      throw new BudgetHit();
    }
    if (this.sampler) this.sampler.tick();
    const cidx = row * 9 + col;

    for (const val of domains[row][col].slice()) {
      if (this.board.validInput(row, col, val)) {
        this.board.board[row][col] = val;
        if (this.sampler) this.sampler.emit("assign", { cell: cidx, value: val, depth });
        constrictDomains(this.board, row, col, val, domains, this.emit, cidx);

        if (!emptyDomain(this.board, domains)) {
          if (this.rec(domains, depth + 1)) return true;
        }

        this.board.board[row][col] = 0;
        if (this.sampler) this.sampler.emit("unassign", { cell: cidx, value: val, depth });
        this.board.backtracks += 1;
        repairDomains(this.board, row, col, val, domains, this.emit);
      }
    }
    return false;
  }
}

function core(puzzle: string, sampler: StepSampler | null, maxSteps: number | undefined): CoreResult {
  const board = SudokuBoard.fromString(puzzle);
  board.uniqueStates = 0;
  if (sampler) sampler.emit("start", { algorithm: ALGORITHM_NAME, givens: puzzle });
  const domains = setDomains(board);
  const runner = new Runner(board, sampler, maxSteps);

  let reason: CoreResult["reason"] = "exhausted";
  try {
    if (runner.rec(domains)) reason = "solved";
  } catch (e) {
    if (e instanceof BudgetHit) reason = "max_steps";
    else throw e;
  }
  const solution =
    reason === "solved" ? board.board.map((r) => r.join("")).join("") : null;
  if (sampler) {
    if (reason === "solved") sampler.emit("solved", { solution });
    else sampler.emit("stopped", { reason });
  }
  return {
    solution,
    solved: reason === "solved",
    nodes: board.uniqueStates,
    backtracks: board.backtracks,
    reason,
  };
}

export function solve(puzzle: string, options: SolveOptions = {}): SolveResult {
  const p = normalizePuzzle(puzzle);
  const sampler = makeSampler(options.onStep, options.maxEvents, options.maxSteps);
  const [result, ms] = timed(() => core(p, sampler, options.maxSteps));
  return finish(result, ALGORITHM_NAME, ms, sampler);
}

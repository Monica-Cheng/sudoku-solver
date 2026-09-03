/**
 * Algo1 - plain recursive backtracking with peer-based candidate filtering.
 * Literal port of solvers/backtracking/core.py: same cell order (A1..I9),
 * first-blank selection, ascending candidate order, node/backtrack accounting,
 * and full-grid validity goal test.
 */
import { finish, makeSampler, normalizePuzzle, timed } from "../base.js";
import type { CoreResult } from "../base.js";
import type { SolveOptions, SolveResult } from "../types.js";
import type { StepSampler } from "../sampler.js";

const ROWS = "ABCDEFGHI";
const COLS = "123456789";
const DIGITS = COLS;

const SQUARES: string[] = [];
for (const r of ROWS) for (const c of COLS) SQUARES.push(r + c);

function buildTables(): {
  units: Map<number, string[]>;
  lines: Map<string, string[]>;
  peers: Map<string, Set<string>>;
} {
  const unitrows: number[][] = [];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 3; i++) {
      unitrows.push([1, 1, 1, 2, 2, 2, 3, 3, 3].map((x) => x + r * 3));
    }
  }
  const unitlist = unitrows.flat();

  const units = new Map<number, string[]>();
  for (let i = 1; i <= 9; i++) units.set(i, []);
  SQUARES.forEach((s, i) => units.get(unitlist[i])!.push(s));

  const lines = new Map<string, string[]>();
  for (const rc of ROWS + COLS) {
    lines.set(
      rc,
      SQUARES.filter((s) => s.includes(rc)),
    );
  }

  const unit = new Map<string, number>();
  SQUARES.forEach((s, i) => unit.set(s, unitlist[i]));

  const peers = new Map<string, Set<string>>();
  for (const s of SQUARES) {
    const pl = [...units.get(unit.get(s)!)!, ...lines.get(s[0])!, ...lines.get(s[1])!];
    peers.set(s, new Set(pl.filter((p) => p !== s)));
  }
  return { units, lines, peers };
}

const { units: UNITS, lines: LINES, peers: PEERS } = buildTables();
const IDX = new Map<string, number>(SQUARES.map((s, i) => [s, i]));

export const ALGORITHM_NAME = "backtracking" as const;

class BudgetHit extends Error {}

class Search {
  values: string[]; // indexed 0..80, same order as SQUARES
  nodes = 0;
  backtracks = 0;
  private sampler: StepSampler | null;
  private cap: number | undefined;
  private budgeted: boolean;

  constructor(puzzle: string, sampler: StepSampler | null, maxSteps: number | undefined) {
    this.values = puzzle.split("");
    this.sampler = sampler;
    this.cap = maxSteps;
    this.budgeted = maxSteps !== undefined;
  }

  private valid(): boolean {
    // Mirrors _valid() in core.py: no blanks anywhere, then every line and box
    // holds 9 distinct values (== set("123456789") given no blanks).
    const v = this.values;
    if (v.includes("0")) return false;
    for (const members of LINES.values()) {
      const set = new Set<string>();
      for (const s of members) set.add(v[IDX.get(s)!]);
      if (set.size !== 9) return false;
    }
    for (const members of UNITS.values()) {
      const set = new Set<string>();
      for (const s of members) set.add(v[IDX.get(s)!]);
      if (set.size !== 9) return false;
    }
    return true;
  }

  run(depth = 0): boolean {
    if (this.valid()) return true;

    let current: string | null = null;
    for (let i = 0; i < 81; i++) {
      if (this.values[i] === "0") {
        current = SQUARES[i];
        break;
      }
    }
    // current is non-null: valid() only returns true on a full grid
    const cur = current!;

    const peerVals = new Set<string>();
    for (const s of PEERS.get(cur)!) peerVals.add(this.values[IDX.get(s)!]);
    const candidates: string[] = [];
    for (const d of DIGITS) if (!peerVals.has(d)) candidates.push(d);

    if (candidates.length === 0) {
      this.backtracks += 1;
      return false;
    }

    const cidx = IDX.get(cur)!;
    for (const d of candidates) {
      this.nodes += 1;
      if (this.budgeted && this.nodes > this.cap!) {
        this.nodes -= 1;
        throw new BudgetHit();
      }
      if (this.sampler) {
        this.sampler.tick();
        this.sampler.emit("assign", { cell: cidx, value: Number(d), depth });
      }
      this.values[cidx] = d;
      if (this.run(depth + 1)) return true;
    }
    if (this.sampler) {
      this.sampler.emit("unassign", {
        cell: cidx,
        value: Number(this.values[cidx]),
        depth,
      });
    }
    this.values[cidx] = "0";
    this.backtracks += 1;
    return false;
  }
}

function core(puzzle: string, sampler: StepSampler | null, maxSteps: number | undefined): CoreResult {
  const s = new Search(puzzle, sampler, maxSteps);
  if (sampler) sampler.emit("start", { algorithm: ALGORITHM_NAME, givens: puzzle });

  let reason: CoreResult["reason"] = "exhausted";
  try {
    if (s.run()) reason = "solved";
  } catch (e) {
    if (e instanceof BudgetHit) reason = "max_steps";
    else throw e;
  }
  const solution = reason === "solved" ? s.values.join("") : null;
  if (sampler) {
    if (reason === "solved") sampler.emit("solved", { solution });
    else sampler.emit("stopped", { reason });
  }
  return { solution, solved: reason === "solved", nodes: s.nodes, backtracks: s.backtracks, reason };
}

export function solve(puzzle: string, options: SolveOptions = {}): SolveResult {
  const p = normalizePuzzle(puzzle);
  const sampler = makeSampler(options.onStep, options.maxEvents, options.maxSteps);
  const [result, ms] = timed(() => core(p, sampler, options.maxSteps));
  return finish(result, ALGORITHM_NAME, ms, sampler);
}

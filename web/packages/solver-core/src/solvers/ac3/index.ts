/**
 * Algo3 - AC-3 propagation, then MRV/LCV/forward-checking backtracking on the
 * remainder. Literal port of solvers/ac3/core.py. One node per recursive call
 * (including the terminal "assignment complete" call); one backtrack per failed
 * value after unassign.
 */
import { finish, makeSampler, normalizePuzzle, timed } from "../../base.js";
import type { CoreResult } from "../../base.js";
import type { StepSampler } from "../../sampler.js";
import type { SolveOptions, SolveResult } from "../../types.js";
import { AC3 } from "./ac3.js";
import { orderDomainValues, selectUnassignedVariable } from "./heuristics.js";
import { coordIdx, Sudoku } from "./sudoku.js";
import { assign, isConsistent, unassign, type Emit } from "./utils.js";

export const ALGORITHM_NAME = "ac3" as const;

class BudgetHit extends Error {}

class Backtracker {
  nodes = 0;
  backtracks = 0;
  private emit: Emit;

  constructor(
    private sudoku: Sudoku,
    private sampler: StepSampler | null,
    private cap: number | undefined,
  ) {
    this.emit = sampler ? sampler.emit.bind(sampler) : null;
  }

  run(assignment: Map<string, number>, depth = 0): Map<string, number> | false {
    this.nodes += 1;
    if (this.cap !== undefined && this.nodes > this.cap) {
      this.nodes -= 1;
      throw new BudgetHit();
    }
    if (this.sampler) this.sampler.tick();

    if (assignment.size === this.sudoku.cells.length) return assignment;

    const cell = selectUnassignedVariable(assignment, this.sudoku);
    const cidx = coordIdx(cell);
    for (const value of orderDomainValues(this.sudoku, cell)) {
      if (isConsistent(this.sudoku, assignment, cell, value)) {
        assign(this.sudoku, cell, value, assignment, this.emit, cidx);
        if (this.sampler) this.sampler.emit("assign", { cell: cidx, value, depth });
        const result = this.run(assignment, depth + 1);
        if (result) return result;
        if (this.sampler) this.sampler.emit("unassign", { cell: cidx, value, depth });
        unassign(this.sudoku, cell, assignment, this.emit);
        this.backtracks += 1;
      }
    }
    return false;
  }
}

function core(puzzle: string, sampler: StepSampler | null, maxSteps: number | undefined): CoreResult {
  if (sampler) sampler.emit("start", { algorithm: ALGORITHM_NAME, givens: puzzle });

  const sudoku = new Sudoku(puzzle);

  if (sampler) sampler.emit("phase", { name: "ac3" });
  const [ok, revisions] = AC3(sudoku, null, sampler);

  let nodes = 0;
  let backtracks = 0;
  let reason: CoreResult["reason"] = "exhausted";

  if (!ok) {
    reason = "no_solution";
  } else if (sudoku.isFinished()) {
    reason = "solved";
  } else {
    if (sampler) sampler.emit("phase", { name: "backtracking" });
    const assignment = new Map<string, number>();
    for (const c of sudoku.cells) {
      const poss = sudoku.possibilities.get(c)!;
      if (poss.length === 1) assignment.set(c, poss[0]);
    }
    const bt = new Backtracker(sudoku, sampler, maxSteps);
    let result: Map<string, number> | false;
    try {
      result = bt.run(assignment);
    } catch (e) {
      if (!(e instanceof BudgetHit)) throw e;
      result = false;
      reason = "max_steps";
    }
    nodes = bt.nodes;
    backtracks = bt.backtracks;
    if (result) {
      for (const c of sudoku.possibilities.keys()) {
        if (result.has(c)) sudoku.possibilities.set(c, [result.get(c)!]);
      }
      reason = "solved";
    } else if (reason !== "max_steps") {
      reason = "exhausted";
    }
  }

  const solution = reason === "solved" ? sudoku.toString() : null;
  if (sampler) {
    if (reason === "solved") sampler.emit("solved", { solution });
    else sampler.emit("stopped", { reason });
  }
  return {
    solution,
    solved: reason === "solved",
    nodes,
    backtracks,
    reason,
    extra: { ac3_revisions: revisions, ac3_alone: nodes === 0 && reason === "solved" },
  };
}

export function solve(puzzle: string, options: SolveOptions = {}): SolveResult {
  const p = normalizePuzzle(puzzle);
  const sampler = makeSampler(options.onStep, options.maxEvents, options.maxSteps);
  const [result, ms] = timed(() => core(p, sampler, options.maxSteps));
  return finish(result, ALGORITHM_NAME, ms, sampler);
}

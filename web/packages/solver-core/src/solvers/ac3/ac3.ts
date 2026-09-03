/** Port of solvers/ac3/ac3.py. */
import type { StepSampler } from "../../sampler.js";
import { coordIdx, type Sudoku } from "./sudoku.js";
import { isDifferent } from "./utils.js";

/** Returns [consistent, revisionCount]. */
export function AC3(
  csp: Sudoku,
  queue: [string, string][] | null,
  sampler: StepSampler | null,
): [boolean, number] {
  const q = queue ?? [...csp.binaryConstraints];
  let revisions = 0;

  while (q.length) {
    const [xi, xj] = q.shift()!;
    if (sampler) sampler.tick();
    const removed = removeInconsistentValues(csp, xi, xj, sampler);
    if (removed.length) {
      revisions += 1;
      if (sampler) {
        sampler.emit("ac3_revise", {
          arc: [coordIdx(xi), coordIdx(xj)],
          removed: [...removed],
          queue_size: q.length,
        });
      }
      if (csp.possibilities.get(xi)!.length === 0) return [false, revisions];
      for (const xk of csp.relatedCells.get(xi)!) {
        if (xk !== xi) q.push([xk, xi]);
      }
    }
  }
  return [true, revisions];
}

function removeInconsistentValues(
  csp: Sudoku,
  cellI: string,
  cellJ: string,
  sampler: StepSampler | null,
): number[] {
  // NOTE: iterates csp.possibilities[cellI] while removing from it, exactly as
  // the Python (and original Algo3) does - this deliberately skips some
  // elements in one pass (they get another chance when the arc is re-queued).
  // A `for...of` iterator over an array advances past a spliced element the
  // same way CPython's list iterator does, so the skip pattern matches. Do not
  // "fix" this.
  const removed: number[] = [];
  const possI = csp.possibilities.get(cellI)!;
  const possJ = csp.possibilities.get(cellJ)!;
  for (const value of possI) {
    let anyDifferent = false;
    for (const poss of possJ) {
      if (isDifferent(value, poss)) {
        anyDifferent = true;
        break;
      }
    }
    if (!anyDifferent) {
      possI.splice(possI.indexOf(value), 1);
      removed.push(value);
      if (sampler) {
        sampler.emit("eliminate", { cell: coordIdx(cellI), value, by: coordIdx(cellJ) });
      }
    }
  }
  return removed;
}

/** Port of solvers/ac3/heuristics.py (MRV variable order, LCV value order). */
import type { Sudoku } from "./sudoku.js";
import { numberOfConflicts } from "./utils.js";

export function selectUnassignedVariable(
  assignment: Map<string, number>,
  sudoku: Sudoku,
): string {
  const unassigned: string[] = [];
  for (const cell of sudoku.cells) {
    if (!assignment.has(cell)) unassigned.push(cell);
  }
  // Python min(unassigned, key=len): first cell achieving the minimum.
  let best = unassigned[0];
  let bestLen = sudoku.possibilities.get(best)!.length;
  for (let i = 1; i < unassigned.length; i++) {
    const len = sudoku.possibilities.get(unassigned[i])!.length;
    if (len < bestLen) {
      best = unassigned[i];
      bestLen = len;
    }
  }
  return best;
}

export function orderDomainValues(sudoku: Sudoku, cell: string): number[] {
  const poss = sudoku.possibilities.get(cell)!;
  if (poss.length === 1) return poss;
  // Python sorted() is stable; so is V8's Array.prototype.sort.
  return [...poss].sort(
    (a, b) => numberOfConflicts(sudoku, cell, a) - numberOfConflicts(sudoku, cell, b),
  );
}

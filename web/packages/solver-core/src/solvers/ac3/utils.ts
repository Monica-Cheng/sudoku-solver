/** Port of solvers/ac3/utils.py (CSP helpers). */
import { coordIdx, type Sudoku } from "./sudoku.js";

export type Emit =
  | ((type: "eliminate" | "restore", fields: Record<string, unknown>) => void)
  | null;

export function isDifferent(a: number, b: number): boolean {
  return a !== b;
}

export function numberOfConflicts(sudoku: Sudoku, cell: string, value: number): number {
  let count = 0;
  for (const relatedC of sudoku.relatedCells.get(cell)!) {
    const poss = sudoku.possibilities.get(relatedC)!;
    if (poss.length > 1 && poss.includes(value)) count += 1;
  }
  return count;
}

export function isConsistent(
  sudoku: Sudoku,
  assignment: Map<string, number>,
  cell: string,
  value: number,
): boolean {
  let consistent = true;
  const related = sudoku.relatedSet.get(cell)!;
  for (const [currentCell, currentValue] of assignment) {
    if (currentValue === value && related.has(currentCell)) consistent = false;
  }
  return consistent;
}

export function assign(
  sudoku: Sudoku,
  cell: string,
  value: number,
  assignment: Map<string, number>,
  emit: Emit,
  cidx: number,
): void {
  assignment.set(cell, value);
  forwardCheck(sudoku, cell, value, assignment, emit, cidx);
}

export function unassign(
  sudoku: Sudoku,
  cell: string,
  assignment: Map<string, number>,
  emit: Emit,
): void {
  if (!assignment.has(cell)) return;
  for (const [coord, value] of sudoku.pruned.get(cell)!) {
    sudoku.possibilities.get(coord)!.push(value);
    if (emit) emit("restore", { cell: coordIdx(coord), value, by: null });
  }
  sudoku.pruned.set(cell, []);
  assignment.delete(cell);
}

export function forwardCheck(
  sudoku: Sudoku,
  cell: string,
  value: number,
  assignment: Map<string, number>,
  emit: Emit,
  cidx: number,
): void {
  for (const relatedC of sudoku.relatedCells.get(cell)!) {
    if (assignment.has(relatedC)) continue;
    const poss = sudoku.possibilities.get(relatedC)!;
    const k = poss.indexOf(value);
    if (k !== -1) {
      poss.splice(k, 1);
      sudoku.pruned.get(cell)!.push([relatedC, value]);
      if (emit) emit("eliminate", { cell: coordIdx(relatedC), value, by: cidx });
    }
  }
}

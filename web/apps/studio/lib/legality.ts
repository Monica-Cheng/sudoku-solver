/**
 * Client-side Sudoku legality check. Re-run on every edit so the /verify
 * conflict warning tracks the grid in real time and can name the digits
 * involved ("two 5s in column 2") rather than just counting cells.
 */

import { boxOf, colOf, rowOf } from "./gridEdits";

export type Unit = "row" | "column" | "box";

export interface Conflict {
  digit: number;
  unit: Unit;
  /** 0-based index of the row / column / box */
  unitIndex: number;
  /** every cell in that unit holding `digit` (always length >= 2) */
  cells: number[];
}

function scanUnit(
  grid: string,
  cells: number[],
  unit: Unit,
  unitIndex: number,
  out: Conflict[],
): void {
  const byDigit = new Map<number, number[]>();
  for (const i of cells) {
    const d = grid.charCodeAt(i) - 48;
    if (d >= 1 && d <= 9) {
      const bucket = byDigit.get(d);
      if (bucket) bucket.push(i);
      else byDigit.set(d, [i]);
    }
  }
  for (const [digit, group] of byDigit) {
    if (group.length >= 2) out.push({ digit, unit, unitIndex, cells: group });
  }
}

const UNIT_RANK: Record<Unit, number> = { row: 0, column: 1, box: 2 };

/**
 * Every clash of the same digit in a row, column or box. When one pair of cells
 * clashes in more than one unit at once (e.g. same row *and* same box), it is
 * reported once, by the most locating unit (row, then column, then box) — so the
 * warning reads "two 5s in row 1", not "...in row 1, and ...in box 1".
 */
export function findConflicts(grid: string): Conflict[] {
  const raw: Conflict[] = [];
  for (let u = 0; u < 9; u++) {
    const row: number[] = [];
    const col: number[] = [];
    const box: number[] = [];
    for (let k = 0; k < 9; k++) {
      row.push(u * 9 + k);
      col.push(k * 9 + u);
      // cells of box u, in order
      const br = Math.floor(u / 3) * 3 + Math.floor(k / 3);
      const bc = (u % 3) * 3 + (k % 3);
      box.push(br * 9 + bc);
    }
    scanUnit(grid, row, "row", u, raw);
    scanUnit(grid, col, "column", u, raw);
    scanUnit(grid, box, "box", u, raw);
  }

  const bySet = new Map<string, Conflict>();
  for (const c of raw) {
    const key = `${c.digit}:${[...c.cells].sort((a, b) => a - b).join(",")}`;
    const seen = bySet.get(key);
    if (!seen || UNIT_RANK[c.unit] < UNIT_RANK[seen.unit]) bySet.set(key, c);
  }
  return [...bySet.values()];
}

/** Flat set of every cell involved in any conflict — for grid highlighting. */
export function conflictCellSet(conflicts: Conflict[]): Set<number> {
  const s = new Set<number>();
  for (const c of conflicts) for (const i of c.cells) s.add(i);
  return s;
}

const COUNT_WORDS = [
  "",
  "",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** "two 5s in column 2" (units are 1-based for humans). */
export function describeConflict(c: Conflict): string {
  return `${countWord(c.cells.length)} ${c.digit}s in ${c.unit} ${c.unitIndex + 1}`;
}

/**
 * One sentence for the warning panel, e.g.
 *   "Two 5s in column 2."
 *   "Two 5s in column 2, and two 1s in row 1."
 * Returns "" when the grid is legal.
 */
export function describeConflicts(conflicts: Conflict[]): string {
  if (conflicts.length === 0) return "";
  const parts = conflicts.map(describeConflict);
  let joined: string;
  if (parts.length === 1) joined = parts[0];
  else if (parts.length === 2) joined = `${parts[0]}, and ${parts[1]}`;
  else joined = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1) + ".";
}

// re-exported so callers don't need a second import for cell math
export { rowOf, colOf, boxOf };

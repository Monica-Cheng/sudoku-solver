/**
 * Cell addressing (mirrors solvers/cellref.py). Every solver and every event
 * refers to a cell by an integer 0..80, row-major (index = row*9 + col), which
 * is also its position in the 81-char puzzle string. Algo3 names cells
 * "A1".."I9" internally (letter = row A..I, digit = column 1..9).
 */
const ROW_LETTERS = "ABCDEFGHI";

export function coordToIndex(coord: string): number {
  return ROW_LETTERS.indexOf(coord[0]) * 9 + (Number(coord[1]) - 1);
}

export function indexToCoord(index: number): string {
  const row = Math.floor(index / 9);
  const col = index % 9;
  return `${ROW_LETTERS[row]}${col + 1}`;
}

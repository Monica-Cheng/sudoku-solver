/**
 * Pure editing state machine for a 9x9 Sudoku grid, shared by /verify and the
 * manual-entry tab on /. No React — every rule here is unit-tested directly.
 *
 * A grid is the 81-char string used everywhere else in the app ("0" = blank).
 * Selection is a cell index 0..80, or null when nothing is selected.
 */

export const CELLS = 81;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Overwrite cell `i` with `value` (0 clears it). Returns a new 81-char grid. */
export function setCell(grid: string, i: number, value: number): string {
  return grid.slice(0, i) + String(value) + grid.slice(i + 1);
}

export type NavKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Tab"
  | "ShiftTab";

/**
 * Where the selection lands for a navigation key. Arrows clamp at the edges;
 * Tab / Shift-Tab move to the next / previous cell in reading order and wrap
 * around the whole grid (so a digit can auto-advance off the end of a row).
 */
export function moveSelection(i: number, key: NavKey): number {
  const r = rowOf(i);
  const c = colOf(i);
  switch (key) {
    case "ArrowUp":
      return r > 0 ? i - 9 : i;
    case "ArrowDown":
      return r < 8 ? i + 9 : i;
    case "ArrowLeft":
      return c > 0 ? i - 1 : i;
    case "ArrowRight":
      return c < 8 ? i + 1 : i;
    case "Tab":
      return (i + 1) % CELLS;
    case "ShiftTab":
      return (i + CELLS - 1) % CELLS;
  }
}

export interface EditState {
  grid: string;
  selected: number | null;
}

export interface KeyOutcome {
  grid: string;
  selected: number | null;
  /** cell whose low-confidence flag should be dropped (it was just edited), else null */
  clearedFlag: number | null;
  /** true when the key belonged to the grid and the caller should preventDefault */
  handled: boolean;
}

const NAV_ARROWS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

/**
 * Apply one key press to the edit state.
 *
 *   1-9        set the cell, then auto-advance one cell (enter a row without clicking)
 *   0 / Del / Backspace   clear the cell, keep the selection put
 *   Arrows     move the selection (clamped at edges)
 *   Tab / Shift-Tab   move forward / back, wrapping
 *   Escape     deselect
 *
 * Editing a cell (setting or clearing) reports it in `clearedFlag` so the caller
 * can drop a low-confidence flag. When nothing is selected, or the key isn't
 * one we handle, `handled` is false and the state is returned unchanged.
 */
export function handleKey(
  state: EditState,
  key: string,
  shift = false,
): KeyOutcome {
  const { grid, selected } = state;
  const passthrough: KeyOutcome = {
    grid,
    selected,
    clearedFlag: null,
    handled: false,
  };

  if (key === "Escape") {
    return selected === null
      ? passthrough
      : { grid, selected: null, clearedFlag: null, handled: true };
  }

  if (key === "Tab") {
    if (selected === null) return passthrough;
    return {
      grid,
      selected: moveSelection(selected, shift ? "ShiftTab" : "Tab"),
      clearedFlag: null,
      handled: true,
    };
  }

  if (selected === null) return passthrough;

  if (NAV_ARROWS.has(key)) {
    return {
      grid,
      selected: moveSelection(selected, key as NavKey),
      clearedFlag: null,
      handled: true,
    };
  }

  if (key === "Backspace" || key === "Delete" || key === "0") {
    return {
      grid: setCell(grid, selected, 0),
      selected,
      clearedFlag: selected,
      handled: true,
    };
  }

  if (/^[1-9]$/.test(key)) {
    return {
      grid: setCell(grid, selected, Number(key)),
      selected: moveSelection(selected, "Tab"),
      clearedFlag: selected,
      handled: true,
    };
  }

  return passthrough;
}

/**
 * Set a digit into the current cell (0 clears) without auto-advancing — used by
 * the touch number pad, where the selection staying put makes correcting a
 * single misread cell predictable.
 */
export function pressDigit(state: EditState, digit: number): KeyOutcome {
  const { grid, selected } = state;
  if (selected === null) {
    return { grid, selected, clearedFlag: null, handled: false };
  }
  return {
    grid: setCell(grid, selected, digit),
    selected,
    clearedFlag: selected,
    handled: true,
  };
}

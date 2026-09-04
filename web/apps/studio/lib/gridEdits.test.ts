import { describe, expect, it } from "vitest";
import {
  handleKey,
  moveSelection,
  pressDigit,
  setCell,
  type EditState,
} from "./gridEdits";

const BLANK = "0".repeat(81);

/** grid with a single digit at `i` */
function gridWith(i: number, d: number) {
  return setCell(BLANK, i, d);
}

describe("moveSelection", () => {
  it("arrows step one cell and clamp at the edges", () => {
    expect(moveSelection(40, "ArrowUp")).toBe(31);
    expect(moveSelection(40, "ArrowDown")).toBe(49);
    expect(moveSelection(40, "ArrowLeft")).toBe(39);
    expect(moveSelection(40, "ArrowRight")).toBe(41);

    expect(moveSelection(0, "ArrowUp")).toBe(0); // top row
    expect(moveSelection(0, "ArrowLeft")).toBe(0); // left column
    expect(moveSelection(80, "ArrowDown")).toBe(80); // bottom-right
    expect(moveSelection(8, "ArrowRight")).toBe(8); // end of row 0, no wrap
  });

  it("Tab / Shift-Tab move in reading order and wrap the whole grid", () => {
    expect(moveSelection(8, "Tab")).toBe(9); // across a row boundary
    expect(moveSelection(80, "Tab")).toBe(0); // wrap to the start
    expect(moveSelection(0, "ShiftTab")).toBe(80); // wrap to the end
    expect(moveSelection(9, "ShiftTab")).toBe(8);
  });
});

describe("handleKey", () => {
  const at = (i: number, grid = BLANK): EditState => ({ grid, selected: i });

  it("does nothing when no cell is selected", () => {
    const r = handleKey({ grid: BLANK, selected: null }, "5");
    expect(r.handled).toBe(false);
    expect(r.grid).toBe(BLANK);
    expect(r.selected).toBeNull();
  });

  it("typing 1-9 sets the cell and auto-advances", () => {
    const r = handleKey(at(0), "7");
    expect(r.handled).toBe(true);
    expect(r.grid[0]).toBe("7");
    expect(r.selected).toBe(1);
    expect(r.clearedFlag).toBe(0);
  });

  it("typing a digit replaces whatever was there", () => {
    const r = handleKey(at(3, gridWith(3, 4)), "9");
    expect(r.grid[3]).toBe("9");
  });

  it("Backspace / Delete / 0 clear the cell and keep the selection put", () => {
    for (const key of ["Backspace", "Delete", "0"]) {
      const r = handleKey(at(10, gridWith(10, 5)), key);
      expect(r.handled).toBe(true);
      expect(r.grid[10]).toBe("0");
      expect(r.selected).toBe(10);
      expect(r.clearedFlag).toBe(10);
    }
  });

  it("arrow keys move the selection without touching the grid", () => {
    const r = handleKey(at(40, gridWith(40, 2)), "ArrowRight");
    expect(r.selected).toBe(41);
    expect(r.grid).toBe(gridWith(40, 2));
    expect(r.clearedFlag).toBeNull();
  });

  it("Tab and Shift-Tab move forward and back", () => {
    expect(handleKey(at(5), "Tab").selected).toBe(6);
    expect(handleKey(at(5), "Tab", true).selected).toBe(4);
  });

  it("Escape deselects", () => {
    const r = handleKey(at(20), "Escape");
    expect(r.handled).toBe(true);
    expect(r.selected).toBeNull();
  });

  it("Escape with nothing selected is a no-op passthrough", () => {
    const r = handleKey({ grid: BLANK, selected: null }, "Escape");
    expect(r.handled).toBe(false);
  });

  it("ignores unrelated keys", () => {
    for (const key of ["a", "Enter", " ", "F5", "Shift"]) {
      expect(handleKey(at(0), key).handled).toBe(false);
    }
  });

  it("a whole row can be entered by repeated digit presses", () => {
    let state: EditState = { grid: BLANK, selected: 0 };
    for (const d of "534678912") {
      const r = handleKey(state, d);
      state = { grid: r.grid, selected: r.selected };
    }
    expect(state.grid.slice(0, 9)).toBe("534678912");
    expect(state.selected).toBe(9); // advanced onto the next row
  });
});

describe("pressDigit (touch number pad)", () => {
  it("sets the digit without advancing the selection", () => {
    const r = pressDigit({ grid: BLANK, selected: 4 }, 6);
    expect(r.grid[4]).toBe("6");
    expect(r.selected).toBe(4);
    expect(r.clearedFlag).toBe(4);
  });

  it("0 clears the current cell", () => {
    const r = pressDigit({ grid: gridWith(4, 6), selected: 4 }, 0);
    expect(r.grid[4]).toBe("0");
    expect(r.selected).toBe(4);
  });

  it("is a no-op with no selection", () => {
    expect(pressDigit({ grid: BLANK, selected: null }, 3).handled).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  conflictCellSet,
  describeConflict,
  describeConflicts,
  findConflicts,
} from "./legality";
import { setCell } from "./gridEdits";

const BLANK = "0".repeat(81);

describe("findConflicts", () => {
  it("finds nothing in a blank grid", () => {
    expect(findConflicts(BLANK)).toEqual([]);
  });

  it("finds nothing in a legal (solved) grid", () => {
    const solved =
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    expect(findConflicts(solved)).toEqual([]);
  });

  it("flags two of the same digit in a row", () => {
    // row 0: digit 5 at columns 1 and 2
    let g = setCell(BLANK, 1, 5);
    g = setCell(g, 2, 5);
    const cs = findConflicts(g);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({
      digit: 5,
      unit: "row",
      unitIndex: 0,
      cells: [1, 2],
    });
  });

  it("flags a column clash", () => {
    // column 2: digit 5 at rows 0 and 1 -> cells 2 and 11
    let g = setCell(BLANK, 2, 5);
    g = setCell(g, 11, 5);
    const cs = findConflicts(g);
    // same clash also lands in box 0
    const col = cs.find((c) => c.unit === "column");
    expect(col).toMatchObject({ digit: 5, unitIndex: 2, cells: [2, 11] });
  });

  it("flags a box clash between cells that share no row or column", () => {
    // box 0: cell 0 (r0c0) and cell 10 (r1c1)
    let g = setCell(BLANK, 0, 9);
    g = setCell(g, 10, 9);
    const cs = findConflicts(g);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ digit: 9, unit: "box", unitIndex: 0 });
    expect(cs[0].cells.sort((a, b) => a - b)).toEqual([0, 10]);
  });

  it("groups three-in-a-unit into one conflict", () => {
    let g = setCell(BLANK, 0, 3);
    g = setCell(g, 1, 3);
    g = setCell(g, 2, 3);
    const row = findConflicts(g).find((c) => c.unit === "row");
    expect(row?.cells).toEqual([0, 1, 2]);
  });

  it("clears the conflict once the misread is fixed", () => {
    let g = setCell(BLANK, 1, 5);
    g = setCell(g, 2, 5);
    expect(findConflicts(g)).toHaveLength(1);
    g = setCell(g, 2, 6); // correct the second cell
    expect(findConflicts(g)).toEqual([]);
  });
});

describe("conflictCellSet", () => {
  it("is the flat union of every conflicting cell", () => {
    let g = setCell(BLANK, 1, 5);
    g = setCell(g, 2, 5);
    const set = conflictCellSet(findConflicts(g));
    expect([...set].sort((a, b) => a - b)).toEqual([1, 2]);
  });
});

describe("describeConflict / describeConflicts", () => {
  it("names the digit and the 1-based unit", () => {
    expect(
      describeConflict({
        digit: 5,
        unit: "column",
        unitIndex: 1,
        cells: [1, 10],
      }),
    ).toBe("two 5s in column 2");
  });

  it("uses a count word for three", () => {
    expect(
      describeConflict({ digit: 3, unit: "row", unitIndex: 0, cells: [0, 1, 2] }),
    ).toBe("three 3s in row 1");
  });

  it("builds one capitalised sentence for the panel", () => {
    let g = setCell(BLANK, 1, 5);
    g = setCell(g, 2, 5);
    expect(describeConflicts(findConflicts(g))).toBe("Two 5s in row 1.");
  });

  it("joins multiple conflicts with 'and'", () => {
    const s = describeConflicts([
      { digit: 5, unit: "column", unitIndex: 1, cells: [1, 10] },
      { digit: 1, unit: "row", unitIndex: 0, cells: [3, 4] },
    ]);
    expect(s).toBe("Two 5s in column 2, and two 1s in row 1.");
  });

  it("is empty for a legal grid", () => {
    expect(describeConflicts(findConflicts(BLANK))).toBe("");
  });
});

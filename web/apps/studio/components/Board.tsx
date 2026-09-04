"use client";

import { memo } from "react";
import { CellStatus, GridModel } from "@/lib/gridState";

interface BoardProps {
  model: GridModel;
  /** bump to force a re-read of the mutable model */
  tick?: number;
  /** currently selected cell (interactive grids only) */
  selectedCell?: number | null;
  /** cells that are part of a legality conflict — drawn in the fail colour */
  conflictCells?: ReadonlySet<number>;
  /** when provided, cells become clickable and report their index */
  onCellClick?: (cell: number) => void;
  lowConfidence?: ReadonlySet<number>;
  className?: string;
}

function cellClass(
  model: GridModel,
  i: number,
  now: number,
  low: boolean,
  selected: boolean,
  conflict: boolean,
): string {
  const parts = ["cell"];
  const st = model.status[i];
  if (st === CellStatus.Given) parts.push("cell--given");
  else if (st === CellStatus.Solved) parts.push("cell--solved");
  else if (st === CellStatus.Trying) parts.push("cell--trying");
  if (model.flashUntil[i] > now) parts.push("cell--failed");
  if (model.pulseUntil[i] > now) parts.push("cell--pulse");
  if (low) parts.push("cell--lowconf");
  if (conflict) parts.push("cell--conflict");
  if (selected) parts.push("cell--selected");
  return parts.join(" ");
}

function PencilMarks({ mask }: { mask: number }) {
  if (mask === 0) return null;
  return (
    <span className="cands" aria-hidden>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className={`cand${mask & (1 << k) ? "" : " cand--out"}`}>
          {k + 1}
        </span>
      ))}
    </span>
  );
}

export const Board = memo(function Board({
  model,
  selectedCell = null,
  conflictCells,
  onCellClick,
  lowConfidence,
  className = "",
}: BoardProps) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const interactive = typeof onCellClick === "function";

  return (
    <div
      className={`board-grid ${className}`}
      role="grid"
      aria-label="sudoku grid"
    >
      {Array.from({ length: 81 }, (_, i) => {
        const v = model.values[i];
        const low = !!lowConfidence?.has(i);
        const conflict = !!conflictCells?.has(i);
        const selected = selectedCell === i;
        const cls = cellClass(model, i, now, low, selected, conflict);
        const mask = v > 0 ? 0 : model.cands[i];

        if (interactive) {
          return (
            <button
              key={i}
              type="button"
              className={cls}
              role="gridcell"
              aria-label={`row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}${
                v > 0 ? `, ${v}` : ", empty"
              }`}
              aria-selected={selected}
              data-i={i}
              tabIndex={-1}
              onClick={() => onCellClick!(i)}
            >
              {v > 0 ? v : <PencilMarks mask={mask} />}
            </button>
          );
        }

        return (
          <div key={i} className={cls} role="gridcell" data-i={i}>
            {v > 0 ? v : <PencilMarks mask={mask} />}
          </div>
        );
      })}
    </div>
  );
});

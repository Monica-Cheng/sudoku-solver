"use client";

import { memo, useEffect, useRef } from "react";
import { CellStatus, GridModel } from "@/lib/gridState";

interface BoardProps {
  model: GridModel;
  /** bump to force a re-read of the mutable model */
  tick?: number;
  editable?: boolean;
  onEdit?: (cell: number, value: number) => void;
  editingCell?: number | null;
  lowConfidence?: ReadonlySet<number>;
  className?: string;
}

function cellClass(
  model: GridModel,
  i: number,
  now: number,
  editing: boolean,
  low: boolean,
): string {
  const parts = ["cell"];
  const st = model.status[i];
  if (st === CellStatus.Given) parts.push("cell--given");
  else if (st === CellStatus.Solved) parts.push("cell--solved");
  else if (st === CellStatus.Trying) parts.push("cell--trying");
  if (model.flashUntil[i] > now) parts.push("cell--failed");
  if (model.pulseUntil[i] > now) parts.push("cell--pulse");
  if (low) parts.push("cell--lowconf");
  if (editing) parts.push("cell--editing");
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
  editable = false,
  onEdit,
  editingCell = null,
  lowConfidence,
  className = "",
}: BoardProps) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;

  return (
    <div
      className={`board-grid ${className}`}
      role="grid"
      aria-label="sudoku grid"
    >
      {Array.from({ length: 81 }, (_, i) => {
        const v = model.values[i];
        const low = !!lowConfidence?.has(i);
        const isEditing = editingCell === i;
        const digitCells = editable
          ? // in editable mode show the value, or a placeholder
            v > 0
            ? v
            : ""
          : v > 0
            ? v
            : "";
        return (
          <CellView
            key={i}
            index={i}
            display={digitCells}
            className={cellClass(model, i, now, isEditing, low)}
            editable={editable && model.status[i] !== CellStatus.Given}
            mask={v > 0 ? 0 : model.cands[i]}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
});

function CellView({
  index,
  display,
  className,
  editable,
  mask,
  onEdit,
}: {
  index: number;
  display: number | string;
  className: string;
  editable: boolean;
  mask: number;
  onEdit?: (cell: number, value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // keep the DOM node's contentEditable text in sync only when not focused
  useEffect(() => {
    if (!editable || !ref.current) return;
    if (document.activeElement !== ref.current) {
      ref.current.textContent = display === "" ? "" : String(display);
    }
  }, [display, editable]);

  if (!editable) {
    return (
      <div className={className} role="gridcell" data-i={index}>
        {display === "" ? <PencilMarks mask={mask} /> : display}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      role="gridcell"
      data-i={index}
      contentEditable
      suppressContentEditableWarning
      inputMode="numeric"
      onFocus={(e) => {
        const el = e.currentTarget;
        const r = document.createRange();
        r.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(r);
      }}
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
          e.preventDefault();
          onEdit?.(index, 0);
          e.currentTarget.textContent = "";
        } else if (/^[1-9]$/.test(e.key)) {
          e.preventDefault();
          onEdit?.(index, Number(e.key));
          e.currentTarget.textContent = e.key;
          e.currentTarget.blur();
        } else if (e.key !== "Tab" && !e.key.startsWith("Arrow")) {
          e.preventDefault();
        }
      }}
      onBlur={(e) => {
        const t = e.currentTarget.textContent?.trim() ?? "";
        if (/^[1-9]$/.test(t)) onEdit?.(index, Number(t));
        else if (t === "") onEdit?.(index, 0);
      }}
    >
      {display === "" ? <PencilMarks mask={mask} /> : display}
    </div>
  );
}

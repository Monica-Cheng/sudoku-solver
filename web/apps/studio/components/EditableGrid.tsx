"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Board } from "@/components/Board";
import { GridModel } from "@/lib/gridState";
import { handleKey, pressDigit, type EditState } from "@/lib/gridEdits";
import { conflictCellSet, findConflicts } from "@/lib/legality";

interface Props {
  /** 81-char grid, "0" = blank */
  grid: string;
  onChange: (grid: string) => void;
  /** cells the recognizer flagged; editing one clears it via onClearFlag */
  lowConfidence?: ReadonlySet<number>;
  onClearFlag?: (cell: number) => void;
  className?: string;
}

/**
 * The one editable Sudoku grid, shared by /verify and the manual-entry tab.
 * Owns selection, keyboard handling and the touch number pad; the edit rules
 * themselves live in lib/gridEdits (unit-tested). Legality is re-checked on
 * every render so conflicting cells light up immediately.
 */
export function EditableGrid({
  grid,
  onChange,
  lowConfidence,
  onClearFlag,
  className = "",
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => new GridModel(grid, "backtracking"),
    [grid],
  );
  const conflictCells = useMemo(
    () => conflictCellSet(findConflicts(grid)),
    [grid],
  );

  const commit = useCallback(
    (next: ReturnType<typeof handleKey>) => {
      if (!next.handled) return;
      if (next.grid !== grid) onChange(next.grid);
      setSelected(next.selected);
      if (
        next.clearedFlag !== null &&
        lowConfidence?.has(next.clearedFlag)
      ) {
        onClearFlag?.(next.clearedFlag);
      }
    },
    [grid, onChange, lowConfidence, onClearFlag],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const state: EditState = { grid, selected };
      const next = handleKey(state, e.key, e.shiftKey);
      if (next.handled) {
        e.preventDefault();
        commit(next);
      }
    },
    [grid, selected, commit],
  );

  const selectCell = useCallback((i: number) => {
    setSelected(i);
    surfaceRef.current?.focus();
  }, []);

  const tapDigit = useCallback(
    (digit: number) => {
      commit(pressDigit({ grid, selected }, digit));
      surfaceRef.current?.focus();
    },
    [grid, selected, commit],
  );

  // deselect when focus leaves the grid surface entirely (not for numpad taps,
  // which refocus synchronously)
  const onBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setSelected(null);
    }
  }, []);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div
        ref={surfaceRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="rounded outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
        aria-label="editable sudoku grid — arrow keys to move, 1-9 to fill, 0 or backspace to clear"
      >
        <Board
          model={model}
          selectedCell={selected}
          conflictCells={conflictCells}
          onCellClick={selectCell}
          lowConfidence={lowConfidence}
        />
      </div>

      <NumberPad visible={selected !== null} onDigit={tapDigit} />
    </div>
  );
}

function NumberPad({
  visible,
  onDigit,
}: {
  visible: boolean;
  onDigit: (digit: number) => void;
}) {
  if (!visible) return null;
  return (
    <div
      className="grid w-full grid-cols-3 gap-1.5 num text-[16px] sm:max-w-[280px]"
      role="group"
      aria-label="number pad"
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button
          key={d}
          type="button"
          // keep the grid surface focused so keyboard nav still works after a tap
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onDigit(d)}
          className="rounded border border-border bg-bg-raised py-3.5 text-text transition-colors hover:border-border-strong hover:text-accent active:bg-accent/15"
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => onDigit(0)}
        className="col-span-3 rounded border border-border bg-bg-raised py-2.5 text-[11px] uppercase tracking-wide text-text-dim transition-colors hover:border-border-strong hover:text-fail active:bg-fail/15"
      >
        clear
      </button>
    </div>
  );
}

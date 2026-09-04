"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditableGrid } from "@/components/EditableGrid";
import { describeConflicts, findConflicts } from "@/lib/legality";
import { useAppStore } from "@/lib/store";

export default function VerifyPage() {
  const router = useRouter();
  const recognition = useAppStore((s) => s.recognition);
  const setPuzzle = useAppStore((s) => s.setPuzzle);

  const [grid, setGrid] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (recognition === null) {
      router.replace("/");
      return;
    }
    setGrid(recognition.grid);
    setFlagged(new Set(recognition.lowConfidenceCells));
  }, [recognition, router]);

  const conflicts = useMemo(
    () => (grid ? findConflicts(grid) : []),
    [grid],
  );

  if (!recognition || grid === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-text-faint num">
        loading…
      </div>
    );
  }

  const cellsRead = 81 - (recognition.grid.match(/0/g)?.length ?? 0);

  function clearFlag(cell: number) {
    setFlagged((prev) => {
      if (!prev.has(cell)) return prev;
      const next = new Set(prev);
      next.delete(cell);
      return next;
    });
  }

  function go(mode: "single" | "race") {
    // the corrected grid — not the original recognition — is what gets solved
    setPuzzle(grid!, { ...recognition!, grid: grid! });
    router.push(`/solve?puzzle=${grid}&mode=${mode}&algo=ac3`);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col items-center gap-3">
        <EditableGrid
          grid={grid}
          onChange={setGrid}
          lowConfidence={flagged}
          onClearFlag={clearFlag}
          className="w-full max-w-[560px]"
        />
        <p className="num text-[12px] text-text-faint">
          recognized from your photo · click any cell to correct it
        </p>
      </section>

      <aside className="flex flex-col gap-4">
        <div>
          <h1 className="num text-[13px] text-text">check the read</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-text-dim">
            The recognizer got most cells right. The ones it&rsquo;s unsure about
            are{" "}
            <span className="text-accent underline decoration-dashed">
              underlined
            </span>
            {" "}
            — glance at those against your photo and fix any that are wrong.
          </p>
        </div>

        <div className="rounded border border-border bg-bg-raised p-3 num text-[12px] text-text-dim">
          <div className="flex justify-between">
            <span>cells read</span>
            <span className="text-text">{cellsRead}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>flagged to check</span>
            <span className={flagged.size ? "text-accent" : "text-text"}>
              {flagged.size}
            </span>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="rounded border border-fail/40 bg-fail/5 p-3 text-[12px] leading-relaxed text-text-dim">
            <p className="text-fail">worth a closer look</p>
            <p className="mt-1">{describeConflicts(conflicts)}</p>
            <p className="mt-1 text-text-faint">
              The clashing cells are outlined in red on the grid — one of each
              pair is probably a misread. Fix it and this clears.
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            onClick={() => go("single")}
            className="num rounded bg-accent px-4 py-2.5 text-[13px] font-medium text-black"
          >
            looks right — solve it →
          </button>
          <button
            onClick={() => go("race")}
            className="num rounded border border-accent/50 px-4 py-2.5 text-[13px] text-accent hover:bg-accent/10"
          >
            race all four →
          </button>
          <button
            onClick={() => router.push("/")}
            className="num px-4 py-2 text-[12px] text-text-faint hover:text-text-dim"
          >
            ← start over
          </button>
        </div>
      </aside>
    </div>
  );
}

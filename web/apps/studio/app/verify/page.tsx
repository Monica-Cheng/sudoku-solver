"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "@/components/Board";
import { GridModel } from "@/lib/gridState";
import { useAppStore } from "@/lib/store";

export default function VerifyPage() {
  const router = useRouter();
  const recognition = useAppStore((s) => s.recognition);
  const setPuzzle = useAppStore((s) => s.setPuzzle);

  const [grid, setGrid] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (recognition === null) {
      router.replace("/");
      return;
    }
    setGrid(recognition.grid);
  }, [recognition, router]);

  const model = useMemo(
    () => (grid ? new GridModel(grid, "backtracking") : null),
    [grid, tick],
  );

  if (!recognition || !grid || !model) {
    return (
      <div className="flex flex-1 items-center justify-center text-[12px] text-text-faint num">
        loading…
      </div>
    );
  }

  const lowConf = new Set(recognition.lowConfidenceCells);
  const flaggedCount = lowConf.size;

  function go(mode: "single" | "race") {
    setPuzzle(grid!, recognition!);
    router.push(`/solve?puzzle=${grid}&mode=${mode}&algo=ac3`);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col items-center gap-3">
        <div className="w-full max-w-[560px]">
          <Board
            model={model}
            tick={tick}
            editable
            lowConfidence={lowConf}
            onEdit={(cell, value) => {
              setGrid((g) => g!.slice(0, cell) + String(value) + g!.slice(cell + 1));
              lowConf.delete(cell);
            }}
          />
        </div>
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
            <span className="text-text">
              {81 - (recognition.grid.match(/0/g)?.length ?? 0)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>flagged to check</span>
            <span className={flaggedCount ? "text-accent" : "text-text"}>
              {flaggedCount}
            </span>
          </div>
        </div>

        {recognition.error && (
          <div className="rounded border border-border bg-bg-raised p-3 text-[12px] leading-relaxed text-text-dim">
            <p className="text-accent">worth a closer look</p>
            <p className="mt-1">{recognition.error}</p>
            <p className="mt-1 text-text-faint">
              Two cells hold the same digit in a row, column or box — one of them
              is probably a misread.
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

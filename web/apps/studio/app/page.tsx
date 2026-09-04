"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "@/components/Board";
import { EditableGrid } from "@/components/EditableGrid";
import { GridModel } from "@/lib/gridState";
import { useAppStore } from "@/lib/store";
import { recognizeImage } from "@/lib/api";
import type { RecognitionResult } from "@/lib/types";
import { PUZZLE_LIBRARY, type LibraryPuzzle } from "@/lib/puzzles.generated";
import { TIER_IDS, TIER_LABEL, type TierId } from "@/lib/tiers";

const BLANK = "0".repeat(81);
const TABS = ["library", "manual", "image"] as const;
type Tab = (typeof TABS)[number];
const TIERS = TIER_IDS;
type Tier = TierId;

function isComplete81(p: string) {
  return p.length === 81 && /^[0-9]+$/.test(p);
}
function clueCount(p: string) {
  return 81 - (p.match(/0/g)?.length ?? 0);
}

export default function InputPage() {
  const router = useRouter();
  const setPuzzle = useAppStore((s) => s.setPuzzle);

  const [tab, setTab] = useState<Tab>("library");
  const [tier, setTier] = useState<Tier>("easy");
  const [grid, setGrid] = useState<string>(BLANK);
  const [upload, setUpload] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "no-grid"; result: RecognitionResult }
  >({ state: "idle" });

  // a throwaway GridModel just to render the non-editable preview
  const model = useMemo(() => new GridModel(grid, "backtracking"), [grid]);
  const fileRef = useRef<HTMLInputElement>(null);

  const clues = clueCount(grid);
  const ready = clues > 0 && isComplete81(grid);

  function loadLibrary(p: LibraryPuzzle) {
    setGrid(p.puzzle);
    setTab("library");
  }

  function go(mode: "single" | "race") {
    if (!ready) return;
    setPuzzle(grid, null);
    router.push(`/solve?puzzle=${grid}&mode=${mode}&algo=ac3`);
  }

  async function onFile(file: File) {
    setUpload({ state: "loading" });
    try {
      const result = await recognizeImage(file);
      if (result.gridDetected) {
        setPuzzle(result.grid, result);
        router.push("/verify");
      } else {
        setUpload({ state: "no-grid", result });
        if (/[1-9]/.test(result.grid)) setGrid(result.grid);
      }
    } catch (e) {
      setUpload({
        state: "error",
        message: e instanceof Error ? e.message : "upload failed",
      });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ---- the grid, centre of the screen ---- */}
      <section className="flex flex-col items-center justify-start gap-3">
        {tab === "manual" ? (
          <EditableGrid
            grid={grid}
            onChange={setGrid}
            className="w-full max-w-[560px]"
          />
        ) : (
          <div className="w-full max-w-[560px]">
            <Board model={model} />
          </div>
        )}
        <p className="num text-[12px] text-text-faint">
          {clues === 0
            ? "no puzzle loaded"
            : `${clues} clue${clues === 1 ? "" : "s"}${isComplete81(grid) ? "" : " · incomplete"}`}
        </p>
      </section>

      {/* ---- controls ---- */}
      <aside className="flex flex-col gap-4">
        <div className="flex gap-1 rounded border border-border bg-bg-raised p-1 num text-[12px]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded px-2 py-1.5 capitalize transition-colors ${
                tab === t
                  ? "bg-bg text-text"
                  : "text-text-dim hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <LibraryPanel tier={tier} setTier={setTier} onPick={loadLibrary} current={grid} />
        )}

        {tab === "manual" && (
          <div className="rounded border border-border bg-bg-raised p-4 text-[13px] leading-relaxed text-text-dim">
            <p>
              Click a cell, type <span className="num text-text">1–9</span> (it
              advances to the next cell). Arrow keys or Tab move around,{" "}
              <span className="num text-text">0</span> / Backspace clears, Esc
              deselects. On a phone, a keypad appears when a cell is selected.
              Fill in the givens, leave the rest blank.
            </p>
            <div className="mt-3 flex gap-2 num text-[12px]">
              <button
                className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
                onClick={() => setGrid(BLANK)}
              >
                clear
              </button>
              <button
                className="rounded border border-border px-2 py-1 text-text-dim hover:text-text"
                onClick={() => setGrid(PUZZLE_LIBRARY.easy[0].puzzle)}
              >
                load an example
              </button>
            </div>
          </div>
        )}

        {tab === "image" && (
          <ImagePanel
            upload={upload}
            onPick={() => fileRef.current?.click()}
            onManual={() => setTab("manual")}
          />
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />

        {/* ---- CTAs ---- */}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            disabled={!ready}
            onClick={() => go("single")}
            className="num rounded bg-accent px-4 py-2.5 text-[13px] font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-25"
          >
            solve — watch one algorithm →
          </button>
          <button
            disabled={!ready}
            onClick={() => go("race")}
            className="num rounded border border-accent/50 px-4 py-2.5 text-[13px] text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-25"
          >
            race — all four at once →
          </button>
        </div>
      </aside>
    </div>
  );
}

function LibraryPanel({
  tier,
  setTier,
  onPick,
  current,
}: {
  tier: Tier;
  setTier: (t: Tier) => void;
  onPick: (p: LibraryPuzzle) => void;
  current: string;
}) {
  const list = PUZZLE_LIBRARY[tier];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 num text-[11px]">
        {TIERS.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`rounded-full border px-2.5 py-1 capitalize transition-colors ${
              tier === t
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border text-text-dim hover:text-text"
            }`}
          >
            {TIER_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded border border-border bg-bg-raised">
        {list.map((p, i) => {
          const active = p.puzzle === current;
          return (
            <button
              key={i}
              onClick={() => onPick(p)}
              className={`flex w-full items-center justify-between border-b border-border/60 px-3 py-2 text-left text-[12px] transition-colors last:border-0 ${
                active ? "bg-accent/10" : "hover:bg-bg"
              }`}
            >
              <span className={active ? "text-accent" : "text-text"}>{p.label}</span>
              <span className="num text-text-faint">{p.clues} clues</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-text-faint">
        {tier === "bench-hard"
          ? "The hardest puzzles in the literature — named puzzles and ten 17-clue minimums. Backtracking flails here; AC-3 barely blinks."
          : "Pick one and hit solve — no photo needed."}
      </p>
    </div>
  );
}

function ImagePanel({
  upload,
  onPick,
  onManual,
}: {
  upload:
    | { state: "idle" }
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "no-grid"; result: RecognitionResult };
  onPick: () => void;
  onManual: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onPick}
        disabled={upload.state === "loading"}
        className="flex flex-col items-center gap-2 rounded border border-dashed border-border bg-bg-raised px-4 py-10 text-[13px] text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
      >
        {upload.state === "loading" ? (
          <span className="num">recognizing…</span>
        ) : (
          <>
            <span className="num text-[22px] text-text-faint">[ ]</span>
            <span>choose a photo of a Sudoku</span>
            <span className="text-[11px] text-text-faint">
              JPEG / PNG · posts to the inference API
            </span>
          </>
        )}
      </button>

      {upload.state === "error" && (
        <div className="rounded border border-border bg-bg-raised p-3 text-[12px] leading-relaxed text-text-dim">
          <p className="text-fail">couldn&rsquo;t reach the inference API.</p>
          <p className="mt-1 num text-[11px] text-text-faint">{upload.message}</p>
          <p className="mt-2">
            Is it running?{" "}
            <span className="num">python dev_server.py</span> — or{" "}
            <button className="text-accent underline" onClick={onManual}>
              enter the grid by hand
            </button>
            .
          </p>
        </div>
      )}

      {upload.state === "no-grid" && (
        <div className="rounded border border-border bg-bg-raised p-3 text-[12px] leading-relaxed text-text-dim">
          <p className="text-text">No grid found in that image.</p>
          <p className="mt-1 num text-[11px] text-text-faint">
            {upload.result.error ?? "grid detection returned nothing"}
          </p>
          <p className="mt-2">
            About 1 photo in 26 fails detection — try a straighter, higher-contrast
            shot, or{" "}
            <button className="text-accent underline" onClick={onManual}>
              type it in
            </button>
            {/[1-9]/.test(upload.result.grid) ? " (partial read carried over)." : "."}
          </p>
        </div>
      )}
    </div>
  );
}

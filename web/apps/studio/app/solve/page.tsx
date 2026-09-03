"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AlgorithmName } from "@sudoku/solver-core";
import { SolveSingle } from "@/components/SolveSingle";
import { SolveRace } from "@/components/SolveRace";

const ALGO_IDS: AlgorithmName[] = [
  "backtracking",
  "forward_checking",
  "ac3",
  "min_conflicts",
];

function SolveInner() {
  const params = useSearchParams();
  const puzzle = params.get("puzzle") ?? "";
  const mode = params.get("mode") === "race" ? "race" : "single";
  const algoParam = params.get("algo");
  const algo: AlgorithmName = ALGO_IDS.includes(algoParam as AlgorithmName)
    ? (algoParam as AlgorithmName)
    : "ac3";

  if (puzzle.length !== 81 || !/^[0-9]+$/.test(puzzle)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 num text-[13px] text-text-dim">
        <p>no puzzle in the URL.</p>
        <Link href="/" className="text-accent underline">
          pick one →
        </Link>
      </div>
    );
  }

  return mode === "race" ? (
    <SolveRace puzzle={puzzle} />
  ) : (
    <SolveSingle puzzle={puzzle} initialAlgo={algo} />
  );
}

export default function SolvePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center num text-[12px] text-text-faint">
          loading…
        </div>
      }
    >
      <SolveInner />
    </Suspense>
  );
}

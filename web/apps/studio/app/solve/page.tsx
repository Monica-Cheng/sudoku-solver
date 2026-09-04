"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AlgorithmName } from "@sudoku/solver-core";
import { SolveSingle } from "@/components/SolveSingle";
import { SolveRace } from "@/components/SolveRace";
import { describeConflicts, findConflicts } from "@/lib/legality";

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

  // pre-solve legality check: never start the workers on a rule-breaking grid.
  const conflicts = findConflicts(puzzle);
  if (conflicts.length > 0) {
    return (
      <div className="mx-auto flex max-w-[440px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-[13px] leading-relaxed text-text-dim">
        <p className="num text-fail">this grid breaks the Sudoku rules</p>
        <p>{describeConflicts(conflicts)}</p>
        <p className="text-text-faint">
          A grid that already violates the rules has no solution, so there is
          nothing to solve. Fix the clash and try again.
        </p>
        <Link href="/" className="text-accent underline">
          ← back to input
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

"use client";

import type { AlgorithmName } from "@sudoku/solver-core";
import {
  outcomeFor,
  TONE_BOX,
  TONE_TEXT,
  type SettledRun,
} from "@/lib/outcomes";

/**
 * The result box under the metrics in single-solve mode. One state per
 * terminatedReason; the red treatment is used only for a genuine app failure
 * (no result came back), never for "no solution" or "gave up".
 */
export function OutcomeBanner({
  running,
  settled,
  puzzle,
  algo,
}: {
  running: boolean;
  settled: SettledRun | null;
  puzzle: string;
  algo: AlgorithmName;
}) {
  if (running) return null;
  const outcome = outcomeFor(settled, { puzzle, algo });
  if (!outcome) return null;

  return (
    <div
      className={`rounded border p-3 text-[12px] leading-relaxed text-text-dim ${TONE_BOX[outcome.tone]}`}
    >
      <p>
        <span className={`num ${TONE_TEXT[outcome.tone]}`}>{outcome.headline}</span>{" "}
        — {outcome.detail}
      </p>
      {outcome.tone === "warn" && (
        <p className="mt-1.5 text-text-faint">
          That&rsquo;s the designed outcome, not an error — see{" "}
          <a href="/benchmarks" className="text-accent hover:underline">
            benchmarks
          </a>{" "}
          for how often each algorithm hits this.
        </p>
      )}
      {outcome.tone === "neutral" && (
        <p className="mt-1.5 text-text-faint">
          A complete search can prove this; edit the grid on{" "}
          <a href="/" className="text-accent hover:underline">
            the input page
          </a>{" "}
          to try a different one.
        </p>
      )}
    </div>
  );
}

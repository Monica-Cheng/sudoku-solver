/**
 * Maps a settled solve run to a display outcome. Every `terminatedReason` the
 * solver API can return (`solved`, `exhausted`, `no_solution`, `max_steps`) has
 * a defined state here; the red "error" treatment is reserved for a run that
 * came back with no result at all — a worker crash or a network fault.
 */
import type { AlgorithmName, SolveResult } from "@sudoku/solver-core";
import { budgetFor, failureText } from "./algorithms";

export type OutcomeTone = "ok" | "neutral" | "warn" | "fail";

export interface Outcome {
  tone: OutcomeTone;
  /** short chip text for race mode */
  label: string;
  /** banner headline for single mode */
  headline: string;
  /** plain explanation, one or two sentences */
  detail: string;
  /** true only for a genuine failure (not a puzzle property) */
  isError: boolean;
}

export interface SettledRun {
  status: string;
  result: SolveResult | null;
  message?: string;
}

/**
 * `null` means "nothing to show" — the run is still going, or it was cancelled
 * (algorithm switch / restart) and produced no result.
 */
export function outcomeFor(
  settled: SettledRun | null,
  ctx: { puzzle: string; algo: AlgorithmName },
): Outcome | null {
  if (!settled) return null;
  const r = settled.result;

  if (!r) {
    // a cancelled run resolves with no result and status "stopped" — ignore it.
    if (settled.status !== "error") return null;
    return {
      tone: "fail",
      label: "error",
      headline: "error",
      detail:
        "The solver worker stopped without returning a result" +
        (settled.message ? ` (${settled.message})` : "") +
        ". This is a fault in the app, not a property of the puzzle — try restarting.",
      isError: true,
    };
  }

  switch (r.terminatedReason) {
    case "solved":
      return {
        tone: "ok",
        label: "solved",
        headline: "solved",
        detail: `${fmtInt(r.nodes)} nodes, ${fmtInt(r.backtracks)} backtracks in ${fmtMs(r.runtimeMs)}.`,
        isError: false,
      };

    case "no_solution":
      return {
        tone: "neutral",
        label: "no solution",
        headline: "no solution",
        detail:
          "Constraint propagation reduced some cell to no legal value at all. " +
          "The givens contradict each other — no valid completion exists.",
        isError: false,
      };

    case "exhausted":
      return {
        tone: "neutral",
        label: "no solution",
        headline: "no solution",
        detail:
          "The search explored every possibility and found no valid completion. " +
          "That means the givens contain a contradiction — this grid cannot be solved.",
        isError: false,
      };

    case "max_steps":
      return {
        tone: "warn",
        label: "gave up",
        headline: "gave up",
        detail: failureText(ctx.algo, {
          clues: 81 - (ctx.puzzle.match(/0/g)?.length ?? 0),
          nodes: r.nodes,
          cap: budgetFor(ctx.puzzle, ctx.algo).maxSteps,
        }),
        isError: false,
      };

    default: {
      // exhaustiveness guard: a new TerminatedReason must be handled above
      const _never: never = r.terminatedReason;
      void _never;
      return {
        tone: "neutral",
        label: String(r.terminatedReason),
        headline: String(r.terminatedReason),
        detail: `The run ended with reason "${r.terminatedReason}".`,
        isError: false,
      };
    }
  }
}

/** Tailwind classes for each tone, for the single-mode banner box. */
export const TONE_BOX: Record<OutcomeTone, string> = {
  ok: "border-ok/40 bg-ok/5",
  neutral: "border-border-strong bg-bg-raised",
  warn: "border-accent/40 bg-accent/5",
  fail: "border-fail/40 bg-fail/5",
};

/** Tailwind text colour for the headline / chip. */
export const TONE_TEXT: Record<OutcomeTone, string> = {
  ok: "text-ok",
  neutral: "text-text-dim",
  warn: "text-accent",
  fail: "text-fail",
};

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

import { describe, expect, it } from "vitest";
import type { SolveResult, TerminatedReason } from "@sudoku/solver-core";
import { outcomeFor, type SettledRun } from "./outcomes";

const PUZZLE = "0".repeat(81);
const CTX = { puzzle: PUZZLE, algo: "backtracking" as const };

function result(reason: TerminatedReason): SolveResult {
  return {
    solution: reason === "solved" ? "1".repeat(81) : null,
    solved: reason === "solved",
    runtimeMs: 1,
    nodes: 68,
    backtracks: 12,
    stepsEmitted: 0,
    algorithmName: "backtracking",
    terminatedReason: reason,
    seed: null,
    extra: {},
  };
}

const settled = (reason: TerminatedReason): SettledRun => ({
  status: reason === "solved" ? "done" : "stopped",
  result: result(reason),
});

describe("outcomeFor", () => {
  it("solved -> ok tone, not an error", () => {
    const o = outcomeFor(settled("solved"), CTX)!;
    expect(o.tone).toBe("ok");
    expect(o.isError).toBe(false);
  });

  it("exhausted -> neutral 'no solution', NOT the red error treatment", () => {
    const o = outcomeFor(settled("exhausted"), CTX)!;
    expect(o.tone).toBe("neutral");
    expect(o.isError).toBe(false);
    expect(o.label).toBe("no solution");
    expect(o.detail).toMatch(/every possibility|no valid completion|contradiction/i);
  });

  it("no_solution -> neutral 'no solution', not an error", () => {
    const o = outcomeFor(settled("no_solution"), CTX)!;
    expect(o.tone).toBe("neutral");
    expect(o.isError).toBe(false);
    expect(o.label).toBe("no solution");
    expect(o.detail).toMatch(/propagation|contradict/i);
  });

  it("max_steps -> warn tone with an algorithm-specific explanation", () => {
    const o = outcomeFor(settled("max_steps"), CTX)!;
    expect(o.tone).toBe("warn");
    expect(o.isError).toBe(false);
    expect(o.label).toBe("gave up");
    expect(o.detail.length).toBeGreaterThan(40);
  });

  it("a run with no result and status 'error' IS the red error state", () => {
    const o = outcomeFor(
      { status: "error", result: null, message: "worker terminated" },
      CTX,
    )!;
    expect(o.tone).toBe("fail");
    expect(o.isError).toBe(true);
    expect(o.detail).toMatch(/worker terminated/);
  });

  it("a cancelled run (no result, status 'stopped') shows nothing", () => {
    expect(outcomeFor({ status: "stopped", result: null }, CTX)).toBeNull();
  });

  it("no settled run shows nothing", () => {
    expect(outcomeFor(null, CTX)).toBeNull();
  });

  it("only max_steps and genuine failure are ever flagged, and only failure is an error", () => {
    for (const reason of ["solved", "exhausted", "no_solution", "max_steps"] as const) {
      expect(outcomeFor(settled(reason), CTX)!.isError).toBe(false);
    }
  });
});

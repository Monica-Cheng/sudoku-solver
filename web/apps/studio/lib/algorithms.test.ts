import { describe, expect, it } from "vitest";
import { ALGOS, ALGO_BY_ID, budgetFor, failureText } from "./algorithms";

describe("ALGOS explainer content", () => {
  it("has all four algorithms with complete explainer fields", () => {
    expect(ALGOS.map((a) => a.id).sort()).toEqual([
      "ac3",
      "backtracking",
      "forward_checking",
      "min_conflicts",
    ]);
    for (const a of ALGOS) {
      expect(a.explainer.length).toBeGreaterThanOrEqual(3);
      for (const p of a.explainer) expect(p.length).toBeGreaterThan(120);
      expect(a.onScreen).toMatch(/\w/);
      expect(a.strengths).toMatch(/\d/); // cites a number
      expect(a.weaknesses).toMatch(/\d/);
      expect(a.verdict.toLowerCase()).toContain("win");
    }
  });

  it("ties each explainer to the events it emits", () => {
    expect(ALGO_BY_ID.backtracking.onScreen).toMatch(/assign/i);
    expect(ALGO_BY_ID.backtracking.emits).toBe("assign · unassign");
    expect(ALGO_BY_ID.forward_checking.onScreen).toMatch(/candidate|eliminate|dim/i);
    expect(ALGO_BY_ID.ac3.onScreen).toMatch(/pulse|arc/i);
    expect(ALGO_BY_ID.min_conflicts.onScreen).toMatch(/swap|trade/i);
  });
});

describe("failureText", () => {
  const cases = [
    "backtracking",
    "forward_checking",
    "ac3",
    "min_conflicts",
  ] as const;

  it("names the cap and the node count that was reached, per technique", () => {
    for (const algo of cases) {
      const t = failureText(algo, { clues: 17, nodes: 1_234_567, cap: 1_400_000 });
      expect(t).toContain("1,400,000"); // the cap
      expect(t).toContain("1,234,567"); // where it stopped
      expect(t.length).toBeGreaterThan(120);
    }
  });

  it("cites the clue count where the puzzle's sparsity is the point", () => {
    for (const algo of ["backtracking", "ac3", "min_conflicts"] as const) {
      expect(
        failureText(algo, { clues: 17, nodes: 200000, cap: 200000 }),
      ).toContain("17");
    }
  });

  it("gives backtracking a puzzle-specific reason, not a generic one", () => {
    const t = failureText("backtracking", { clues: 17, nodes: 900000, cap: 1_400_000 });
    expect(t).toMatch(/no record|contradiction|deeper/i);
    expect(t).toContain("900,000");
  });

  it("frames min-conflicts failure as wrong-technique, not tuning", () => {
    const t = failureText("min_conflicts", { clues: 17, nodes: 200000, cap: 200000 });
    expect(t).toMatch(/local search|no backtracking|wrong technique/i);
  });
});

describe("budgetFor", () => {
  it("scales the node budget to how hard the puzzle looks", () => {
    const seventeen = "0".repeat(64) + "1234567890123456".slice(0, 17);
    expect(budgetFor("1".repeat(17) + "0".repeat(64)).maxSteps).toBe(1_400_000);
    expect(budgetFor("1".repeat(24) + "0".repeat(57)).maxSteps).toBe(500_000);
    expect(budgetFor("1".repeat(30) + "0".repeat(51)).maxSteps).toBe(200_000);
    void seventeen;
  });
});

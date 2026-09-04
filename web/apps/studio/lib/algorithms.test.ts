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
      expect(a.frame.length).toBeGreaterThan(120);
    }
  });

  it("every algorithm's frame uses the shared O(b^d) vocabulary", () => {
    for (const a of ALGOS) {
      expect(a.frame).toMatch(/b\^d|branching factor|no tree|no branching/i);
    }
  });

  it("names 'fail-first' where MRV is introduced", () => {
    expect(ALGO_BY_ID.forward_checking.frame + ALGO_BY_ID.forward_checking.explainer.join(" "))
      .toMatch(/fail-first/i);
  });

  it("min-conflicts names its three failure modes and the N-Queens contrast", () => {
    const mc = ALGO_BY_ID.min_conflicts;
    expect(mc.onScreen).toMatch(/local minim/i);
    expect(mc.onScreen).toMatch(/plateau/i);
    expect(mc.onScreen).toMatch(/ridge/i);
    expect(mc.verdict).toMatch(/n-queens/i);
    expect(mc.verdict).toMatch(/94%|253 of 270/);
    expect(mc.verdict).toMatch(/4 of 36/);
  });

  it("min-conflicts explainer text is not backwards about clue count", () => {
    const mc = ALGO_BY_ID.min_conflicts;
    const all = [mc.frame, ...mc.explainer, mc.onScreen, mc.strengths, mc.weaknesses, mc.verdict].join(" ");
    expect(all).not.toMatch(/sparse|few givens|almost no (fixed )?structure/i);
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

  it("stays factually correct at a HIGH clue count — no 'sparse' / 'no structure'", () => {
    for (const algo of cases) {
      const t = failureText(algo, { clues: 35, nodes: 200_000, cap: 200_000 });
      expect(t).not.toMatch(/sparse|almost no (fixed )?structure|few clues|this sparse/i);
    }
  });

  it("backtracking blames the lack of pruning and the empty-cell count, not clue scarcity", () => {
    const t = failureText("backtracking", { clues: 30, nodes: 900_000, cap: 1_400_000 });
    expect(t).toMatch(/no pruning|exponential|no legal value/i);
    expect(t).toContain("900,000");
    expect(t).toContain(String(81 - 30)); // 51 empty cells
  });

  it("min-conflicts: local minima + can't-detect-contradiction, clue-count-independent", () => {
    const t = failureText("min_conflicts", { clues: 29, nodes: 200_000, cap: 200_000 });
    expect(t).toMatch(/local minimum|local search/i);
    expect(t).toMatch(/no backtracking|no memory/i);
    expect(t).toMatch(/contradict|impossible|no conflict-free/i);
    expect(t).toMatch(/depend.* on how many clues|regardless/i);
    expect(t).not.toContain("29"); // the reasoning must not hinge on the clue count
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

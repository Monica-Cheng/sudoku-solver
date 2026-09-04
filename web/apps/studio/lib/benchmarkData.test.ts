import { describe, expect, it } from "vitest";
import {
  ABLATION,
  ABLATION_DELTAS,
  CNN,
  NODE_STATS,
  SOLVE_RATE,
  THRESHOLD_SWEEP,
  TIERS,
  TIMING,
} from "./benchmarkData";

const ALGOS = ["backtracking", "forward_checking", "ac3", "min_conflicts"] as const;

describe("solver benchmark data", () => {
  it("solve rates are solved <= total, deterministic tiers are /30, MC is /90 or /36", () => {
    for (const algo of ALGOS) {
      for (const tier of TIERS) {
        const r = SOLVE_RATE[algo][tier];
        expect(r.solved).toBeLessThanOrEqual(r.total);
        expect(r.solved).toBeGreaterThanOrEqual(0);
        if (algo === "min_conflicts") {
          expect([90, 36]).toContain(r.total);
        } else {
          expect([30, 12]).toContain(r.total);
        }
      }
    }
  });

  it("records the two headline failures exactly as measured", () => {
    expect(SOLVE_RATE.backtracking.extreme).toMatchObject({ solved: 6, total: 12 });
    expect(SOLVE_RATE.min_conflicts.extreme).toMatchObject({ solved: 4, total: 36 });
  });

  it("node medians never exceed the recorded worst", () => {
    for (const algo of ALGOS)
      for (const tier of TIERS) {
        const n = NODE_STATS[algo][tier];
        expect(n.median).toBeLessThanOrEqual(n.worst);
      }
  });

  it("backtracking is the only solver driven to the 1.4M cap", () => {
    expect(NODE_STATS.backtracking.hard.worst).toBe(1_400_000);
    expect(NODE_STATS.ac3.hard.worst).toBeLessThan(2_000);
    expect(NODE_STATS.forward_checking.hard.worst).toBeGreaterThan(100_000);
  });

  it("TypeScript is faster than Python everywhere a pair is recorded", () => {
    for (const algo of ALGOS)
      for (const tier of TIERS) {
        const t = TIMING[algo][tier];
        if (t.py > 0 && t.ts > 0) expect(t.ts).toBeLessThan(t.py);
      }
  });
});

describe("CNN benchmark data", () => {
  it("per-digit accuracy matches errors / cells", () => {
    const implied = (CNN.digitCells - CNN.errors) / CNN.digitCells;
    expect(CNN.perDigitAccuracy).toBeCloseTo(implied, 5);
  });

  it("the confusion matrix sums to the scored cell count", () => {
    const total = Object.values(CNN.confusion).reduce((s, n) => s + n, 0);
    expect(total).toBe(CNN.digitCells);
    const offDiagonal = Object.entries(CNN.confusion)
      .filter(([k]) => k[0] !== k[3])
      .reduce((s, [, n]) => s + n, 0);
    expect(offDiagonal).toBe(CNN.errors);
  });

  it("most misreads are 9s", () => {
    const nines = CNN.misreads.filter((m) => m.was === 9).length;
    expect(nines).toBeGreaterThanOrEqual(2);
  });

  it("ablation configs are ordered best-first and deltas are consistent", () => {
    for (let i = 1; i < ABLATION.length; i++)
      expect(ABLATION[i].accuracy).toBeLessThan(ABLATION[i - 1].accuracy);
    const erodeDelta = (ABLATION[0].accuracy - ABLATION[1].accuracy) * 100;
    expect(erodeDelta).toBeCloseTo(ABLATION_DELTAS.erode, 1);
  });
});

describe("confidence threshold sweep", () => {
  it("false-alarm rate rises monotonically with the threshold", () => {
    for (let i = 1; i < THRESHOLD_SWEEP.length; i++)
      expect(THRESHOLD_SWEEP[i].fpPct).toBeGreaterThanOrEqual(
        THRESHOLD_SWEEP[i - 1].fpPct,
      );
  });

  it("0.80 through 0.85 catch the same 2 of 3 misreads", () => {
    const at = (t: number) => THRESHOLD_SWEEP.find((s) => s.threshold === t)!;
    expect(at(0.8).fn).toBe(1);
    expect(at(0.85).fn).toBe(1);
    expect(at(0.75).fn).toBe(2);
  });
});

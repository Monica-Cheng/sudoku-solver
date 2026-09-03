import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSolvedString,
  isValidEvent,
  LIFECYCLE_TYPES,
  solve,
  SOLVERS,
  type SolverName,
  type StepEvent,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
function readPuzzles(rel: string): string[] {
  const d = readFileSync(resolve(HERE, "../../../..", rel), "utf8").replace(/[^0-9]/g, "");
  const out: string[] = [];
  for (let i = 0; i + 81 <= d.length; i += 81) out.push(d.slice(i, i + 81));
  return out;
}
const EASY = readPuzzles("puzzles/easy.txt");
const HARD = readPuzzles("puzzles/hard.txt");
const BENCH = readPuzzles("benchmarks/hard.txt");
const NAMES = Object.keys(SOLVERS) as SolverName[];

describe("basic correctness", () => {
  it.each(NAMES)("%s solves every easy puzzle to a valid grid", (algo) => {
    for (const p of EASY) {
      const r = solve(p, algo, { seed: 0, maxSteps: 500_000 });
      if (algo === "min_conflicts" && !r.solved) continue; // incomplete method
      expect(r.solved).toBe(true);
      expect(isSolvedString(r.solution)).toBe(true);
      for (let k = 0; k < 81; k++) {
        if (p[k] !== "0") expect(r.solution![k]).toBe(p[k]); // givens preserved
      }
    }
  });

  it("the three systematic solvers agree on a unique-solution puzzle", () => {
    const p = BENCH[0]; // AI Escargot
    const sols = new Set(
      (["backtracking", "forward_checking", "ac3"] as const)
        .map((a) => solve(p, a, { maxSteps: 2_000_000 }).solution)
        .filter((s): s is string => s !== null),
    );
    expect(sols.size).toBe(1);
  });

  it("max_steps stops deterministically at exactly the cap", () => {
    const p = BENCH[1];
    const a = solve(p, "backtracking", { maxSteps: 1234 });
    const b = solve(p, "backtracking", { maxSteps: 1234 });
    expect(a.terminatedReason).toBe("max_steps");
    expect(a.nodes).toBe(1234);
    expect([a.nodes, a.backtracks, a.solution]).toEqual([b.nodes, b.backtracks, b.solution]);
  });

  it("contradictory givens -> no_solution (ac3)", () => {
    const r = solve("11" + "0".repeat(79), "ac3");
    expect(r.solved).toBe(false);
    expect(r.terminatedReason).toBe("no_solution");
  });
});

describe("determinism", () => {
  it("min_conflicts: same seed -> identical run, and the seed is reported", () => {
    const p = HARD[3];
    const a = solve(p, "min_conflicts", { seed: 12345, maxSteps: 50_000 });
    const b = solve(p, "min_conflicts", { seed: 12345, maxSteps: 50_000 });
    expect([a.solution, a.nodes, a.backtracks]).toEqual([b.solution, b.nodes, b.backtracks]);
    expect(a.seed).toBe(12345);
  });

  it("min_conflicts: no seed -> a fresh random seed each call", () => {
    const seeds = new Set(Array.from({ length: 6 }, () => solve(EASY[0], "min_conflicts").seed));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("deterministic solvers ignore seed", () => {
    for (const a of ["backtracking", "forward_checking", "ac3"] as const) {
      const r1 = solve(EASY[0], a, { seed: 1 });
      const r2 = solve(EASY[0], a, { seed: 999 });
      expect([r1.solution, r1.nodes, r1.backtracks]).toEqual([r2.solution, r2.nodes, r2.backtracks]);
      expect(r1.seed).toBeNull();
    }
  });
});

describe("events", () => {
  it.each(NAMES)("%s: every event is structurally valid and in range", (algo) => {
    const evs: StepEvent[] = [];
    const r = solve(HARD[10], algo, { onStep: (e) => evs.push(e), seed: 0, maxSteps: 200_000 });
    expect(evs.length).toBeGreaterThan(0);
    expect(evs[0].type).toBe("start");
    expect(["solved", "stopped"]).toContain(evs[evs.length - 1].type);
    for (const e of evs) expect(isValidEvent(e), JSON.stringify(e)).toBe(true);
    const nonLifecycle = evs.filter((e) => !LIFECYCLE_TYPES.has(e.type));
    expect(r.stepsEmitted).toBe(nonLifecycle.length);
  });

  it.each(NAMES)("%s: assign/swap/reassign never target a given", (algo) => {
    const p = HARD[0];
    const evs: StepEvent[] = [];
    solve(p, algo, { onStep: (e) => evs.push(e), seed: 0, maxSteps: 200_000 });
    for (const e of evs) {
      if (e.type === "assign" || e.type === "reassign") expect(p[e.cell]).toBe("0");
      if (e.type === "swap") {
        expect(p[e.cell_a]).toBe("0");
        expect(p[e.cell_b]).toBe("0");
      }
    }
  });

  it("maxEvents caps delivery and step ordinals are monotonic", () => {
    for (const algo of ["backtracking", "forward_checking", "ac3"] as const) {
      const evs: StepEvent[] = [];
      const r = solve(BENCH[1], algo, {
        onStep: (e) => evs.push(e),
        maxSteps: 100_000,
        maxEvents: 500,
      });
      const nonLifecycle = evs.filter((e) => !LIFECYCLE_TYPES.has(e.type));
      expect(nonLifecycle.length).toBeLessThanOrEqual(500);
      expect(r.stepsEmitted).toBeLessThanOrEqual(500);
      const steps = nonLifecycle.map((e) => e.step);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
    }
  });

  it("near-zero overhead when onStep is omitted", () => {
    const p = HARD[0];
    const bench = (opts: Parameters<typeof solve>[2]) => {
      const t = performance.now();
      for (let i = 0; i < 20; i++) solve(p, "backtracking", { ...opts, seed: 0, maxSteps: 200_000 });
      return performance.now() - t;
    };
    const base = bench({});
    const live = bench({ onStep: () => {}, maxEvents: 1 });
    expect(live).toBeLessThan(base * 2 + 20);
  });
});

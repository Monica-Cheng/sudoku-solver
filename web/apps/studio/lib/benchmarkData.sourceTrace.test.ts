/**
 * benchmarkData.test.ts checks that the numbers on /benchmarks are internally
 * coherent (medians <= worst, TS faster than Python, etc). It does not check
 * that they're the numbers the measurement runs actually produced.
 *
 * This file re-reads the source-of-truth files — benchmarks/results/*.json
 * (written by benchmarks/run_solver_bench.py, bench.ts, run_cnn_bench.py) and
 * tests/fixtures/solver_reference.json (the Python<->TypeScript parity
 * fixture) — and asserts every traceable figure in benchmarkData.ts matches.
 *
 * A few figures on /benchmarks are NOT derived from these files and so are not
 * checked here; see the "untraceable figures" note at the bottom.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ABLATION,
  ABLATION_DELTAS,
  CHOSEN_THRESHOLD,
  CNN,
  METHODOLOGY,
  NODE_STATS,
  SOLVE_RATE,
  THRESHOLD_SWEEP,
  TIERS,
  TIMING,
  type AlgoId,
} from "./benchmarkData";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../.."); // web/apps/studio -> repo root

function readJSON(rel: string): any {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
}
function readText(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const solversPy = readJSON("benchmarks/results/solvers_python.json");
const solversTs = readJSON("benchmarks/results/solvers_ts.json");
const cnnSrc = readJSON("benchmarks/results/cnn.json");
const refFixture = readJSON("tests/fixtures/solver_reference.json");
const sweepTxt = readText("benchmarks/results/threshold_sweep.txt");

const ALGOS: AlgoId[] = ["backtracking", "forward_checking", "ac3", "min_conflicts"];

describe("solve rate (SOLVE_RATE) traces to benchmarks/results/solvers_python.json", () => {
  for (const algo of ALGOS) {
    for (const tier of TIERS) {
      it(`${algo}/${tier}`, () => {
        const src = solversPy.tiers[tier].algos[algo];
        const claimed = SOLVE_RATE[algo][tier];
        expect(claimed.solved).toBe(src.solved);
        expect(claimed.total).toBe(src.runs);
        // the "N timeouts" / "N hit the cap" note, when present, must name the
        // actual max_steps count for that cell
        if (claimed.note) {
          const n = Number(claimed.note.match(/\d+/)?.[0]);
          expect(n).toBe(src.reasons.max_steps ?? 0);
        }
      });
    }
  }
});

describe("node stats (NODE_STATS) trace to benchmarks/results/solvers_python.json", () => {
  for (const algo of ALGOS) {
    for (const tier of TIERS) {
      it(`${algo}/${tier} median (rounded from nodes_solved_median)`, () => {
        const src = solversPy.tiers[tier].algos[algo];
        expect(NODE_STATS[algo][tier].median).toBe(Math.round(src.nodes_solved_median));
      });
      it(`${algo}/${tier} worst (nodes_worst, exact)`, () => {
        const src = solversPy.tiers[tier].algos[algo];
        expect(NODE_STATS[algo][tier].worst).toBe(src.nodes_worst);
      });
    }
  }
});

describe("timing (TIMING) traces to solvers_python.json / solvers_ts.json", () => {
  for (const algo of ALGOS) {
    for (const tier of TIERS) {
      it(`${algo}/${tier}`, () => {
        const py = solversPy.tiers[tier].algos[algo];
        const ts = solversTs.tiers[tier].algos[algo];
        const claimed = TIMING[algo][tier];
        // benchmarkData rounds to ~2dp; the source is a raw float
        expect(claimed.py).toBeCloseTo(py.ms_median, 2);
        expect(claimed.ts).toBeCloseTo(ts.msMedian, 2);
      });
    }
  }
});

describe("methodology claims trace to the recorded run configuration", () => {
  it("caps and repetitions (solvers_python.json)", () => {
    expect(solversPy.max_steps).toBe(1_400_000);
    expect(solversPy.mc_max_steps).toBe(200_000);
    expect(solversPy.mc_seeds).toEqual([0, 1, 2]);
    expect(solversPy.reps).toBe(3);
    // the prose cites these same numbers
    expect(METHODOLOGY.caps).toContain("1,400,000");
    expect(METHODOLOGY.caps).toContain("200,000");
    expect(METHODOLOGY.solverRuns).toMatch(/\(0, 1, 2\)/);
    expect(METHODOLOGY.solverRuns).toContain("3 repetitions");
  });

  it("parity row count (tests/fixtures/solver_reference.json)", () => {
    expect(refFixture.n_rows).toBe(576);
    expect(METHODOLOGY.parity).toContain("576 rows");
  });
});

describe("CNN headline numbers trace to benchmarks/results/cnn.json", () => {
  const b = cnnSrc.baseline;

  it("cell and error counts", () => {
    expect(CNN.images).toBe(cnnSrc.n_images);
    expect(CNN.digitCells).toBe(b.cells_scored);
    expect(CNN.blankCells).toBe(b.blank_cells);
    expect(CNN.errors).toBe(b.errors);
    expect(CNN.detectorErrors).toBe(b.detector_fp + b.detector_fn);
    expect(CNN.detectorCells).toBe(b.blank_cells + b.digit_cells);
  });

  it("accuracy and confidence stats", () => {
    expect(CNN.perDigitAccuracy).toBeCloseTo(b.accuracy, 6);
    expect(CNN.meanConfCorrect).toBeCloseTo(b.conf_mean_correct, 2);
    expect(CNN.meanConfWrong).toBeCloseTo(b.conf_mean_wrong, 4);
    expect(CNN.minConfCorrect).toBeCloseTo(b.conf_min_correct, 4);
    expect(CNN.maxConfWrong).toBeCloseTo(b.conf_max_wrong, 4);
  });

  it("confusion matrix matches exactly", () => {
    expect(CNN.confusion).toEqual(b.confusion);
  });

  it("per-image error counts match (which images have a misread)", () => {
    expect(Object.keys(b.per_image_errors).sort()).toEqual(
      CNN.misreads.map((m) => m.image).sort(),
    );
  });

  it("grids-exactly-matching count traces to threshold_sweep.txt", () => {
    const m = sweepTxt.match(/grids exactly matching GT:\s*(\d+)\/(\d+)/);
    expect(m).not.toBeNull();
    expect(CNN.gridsExact).toBe(Number(m![1]));
    expect(CNN.images).toBe(Number(m![2]));
  });
});

describe("preprocessing ablation traces to benchmarks/results/cnn.json", () => {
  const cases = [
    ["baseline", ABLATION[0]],
    ["no_erode", ABLATION[1]],
    ["inter_nearest", ABLATION[2]],
    ["no_erode_inter_nearest", ABLATION[3]],
  ] as const;

  for (const [key, claimed] of cases) {
    it(key, () => {
      expect(claimed.accuracy).toBeCloseTo(cnnSrc[key].accuracy, 6);
      expect(claimed.errors).toBe(cnnSrc[key].errors);
    });
  }

  it("deltas (percentage points)", () => {
    expect(ABLATION_DELTAS.erode).toBeCloseTo(cnnSrc.ablation_deltas_pp.erode, 2);
    expect(ABLATION_DELTAS.interpolation).toBeCloseTo(
      cnnSrc.ablation_deltas_pp.inter_area_vs_nearest,
      2,
    );
    expect(ABLATION_DELTAS.both).toBeCloseTo(cnnSrc.ablation_deltas_pp.both, 2);
  });
});

describe("confidence-threshold sweep traces to benchmarks/results/threshold_sweep.txt", () => {
  // parse "0.85 32 30 4.52% 1 33.33%"-style rows out of the printed table
  const rows = new Map<number, { flagged: number; fp: number; fpPct: number; fn: number; fnPct: number }>();
  const rowRe = /^\s*(\d\.\d\d)\s+(\d+)\s+(\d+)\s+([\d.]+)%\s+(\d+)\s+([\d.]+)%\s*$/gm;
  for (const m of sweepTxt.matchAll(rowRe)) {
    rows.set(Number(m[1]), {
      flagged: Number(m[2]),
      fp: Number(m[3]),
      fpPct: Number(m[4]),
      fn: Number(m[5]),
      fnPct: Number(m[6]),
    });
  }

  it("the sweep table actually parsed (sanity check on the regex)", () => {
    expect(rows.size).toBe(THRESHOLD_SWEEP.length);
  });

  for (const point of THRESHOLD_SWEEP) {
    it(`threshold ${point.threshold}`, () => {
      const src = rows.get(point.threshold);
      expect(src, `no source row for threshold ${point.threshold}`).toBeDefined();
      expect(point.flagged).toBe(src!.flagged);
      expect(point.fp).toBe(src!.fp);
      expect(point.fpPct).toBeCloseTo(src!.fpPct, 2);
      expect(point.fn).toBe(src!.fn);
      expect(point.fnPct).toBeCloseTo(src!.fnPct, 2);
    });
  }

  it("CHOSEN_THRESHOLD is one of the swept thresholds", () => {
    expect(THRESHOLD_SWEEP.some((p) => p.threshold === CHOSEN_THRESHOLD)).toBe(true);
  });
});

/**
 * Untraceable figures — present on /benchmarks but not derivable from
 * benchmarks/results/*.json or tests/fixtures/solver_reference.json:
 *
 * - CNN.misreads[].conf (0.76 / 0.63 / 0.95): no results file records
 *   per-cell confidence. The only source is a prose comment in
 *   api/_infer.py ("conf 0.63 and 0.76"), which doesn't say which value
 *   belongs to which image. Independently re-measured via api/_infer on the
 *   live pipeline (see the accompanying report): 11.jpg r8c2 is 0.63 and
 *   17.jpg r8c1 is 0.76 — the two are swapped in CNN.misreads.
 *
 * - CNN.distinctPuzzles (16): not in any results file. Documented in
 *   tests/fixtures/README.md from a manual duplicate-photo count. Recomputed
 *   directly from tests/fixtures/gt.json's 24 grid strings: 17 distinct
 *   grids, not 16 (five duplicate groups of sizes 2,4,2,2,2 collapse 12
 *   images to 5 puzzles, plus 12 untouched singletons = 17).
 *
 * - METHODOLOGY.tracemalloc's "3.5-4.9x" figure: a historical Phase 1/2
 *   finding recorded in prose (README.md, run_solver_bench.py's docstring)
 *   with no committed before/after measurement file to check it against.
 *
 * - The "extreme set" puzzle-mix descriptions (METHODOLOGY.puzzleSets, the
 *   tier blurbs on / and lib/tiers.ts, and the min-conflicts verdict) said
 *   "ten of them 17-clue minimums". Counting non-zero characters in
 *   benchmarks/hard.txt gives 7 of the 12 lines at exactly 17 clues, not 10 -
 *   corrected in all five places.
 */

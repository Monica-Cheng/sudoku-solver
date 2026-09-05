/**
 * TS solver benchmark, matched to benchmarks/run_solver_bench.py: same puzzle
 * sets, same caps (1.4M nodes for the deterministic solvers, min_conflicts on
 * its own 200k default), min_conflicts over seeds 0,1,2. Run:
 *
 *     node bench/bench.ts            # Node >= 22 strips the types
 *
 * Writes bench/ts_results.json for the Python-vs-TS comparison on /benchmarks.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { solve, SOLVERS, type SolverName } from "../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../..");

function readPuzzles(rel: string): string[] {
  const d = readFileSync(resolve(ROOT, rel), "utf8").replace(/[^0-9]/g, "");
  const out: string[] = [];
  for (let i = 0; i + 81 <= d.length; i += 81) out.push(d.slice(i, i + 81));
  return out;
}

const TIERS: Record<string, string[]> = {
  easy: readPuzzles("puzzles/easy.txt"),
  medium: readPuzzles("puzzles/medium.txt"),
  hard: readPuzzles("puzzles/hard.txt"),
  extreme: readPuzzles("benchmarks/hard.txt"),
};
const ALGOS = Object.keys(SOLVERS) as SolverName[];
const DETERMINISTIC = new Set(["backtracking", "forward_checking", "ac3"]);
const MAX_STEPS = 1_400_000; // deterministic solvers; MC uses its own 200k default
const MC_SEEDS = [0, 1, 2];
const REPS = 3;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function pct(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const k = ((sorted.length - 1) * p) / 100;
  const lo = Math.floor(k);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
}

function benchOne(puzzle: string, algo: SolverName, seed: number) {
  const opts = DETERMINISTIC.has(algo)
    ? { seed, maxSteps: MAX_STEPS }
    : { seed };
  let t0 = performance.now();
  let r = solve(puzzle, algo, opts);
  const first = performance.now() - t0;
  const times = [first];
  if (first < 40 && r.terminatedReason !== "max_steps") {
    for (let i = 0; i < REPS - 1; i++) {
      t0 = performance.now();
      solve(puzzle, algo, opts);
      times.push(performance.now() - t0);
    }
  }
  return {
    solved: r.solved,
    nodes: r.nodes,
    terminatedReason: r.terminatedReason,
    ms: median(times),
  };
}

// warm-up
for (const algo of ALGOS) {
  for (const p of TIERS.easy.slice(0, 3)) solve(p, algo, { seed: 0, maxSteps: MAX_STEPS });
}

const out: Record<string, unknown> = {
  maxSteps: MAX_STEPS,
  mcMaxSteps: 200_000,
  mcSeeds: MC_SEEDS,
  reps: REPS,
  node: process.version,
  tiers: {} as Record<string, unknown>,
};

for (const [tier, puzzles] of Object.entries(TIERS)) {
  const tierOut: Record<string, unknown> = { n: puzzles.length, algos: {} };
  for (const algo of ALGOS) {
    const seeds = DETERMINISTIC.has(algo) ? [0] : MC_SEEDS;
    const runs: ReturnType<typeof benchOne>[] = [];
    for (const p of puzzles) for (const s of seeds) runs.push(benchOne(p, algo, s));
    const solved = runs.filter((r) => r.solved).length;
    const nodesAll = runs.map((r) => r.nodes).sort((a, b) => a - b);
    const nodesSolved = runs.filter((r) => r.solved).map((r) => r.nodes).sort((a, b) => a - b);
    const msAll = runs.map((r) => r.ms).sort((a, b) => a - b);
    const reasons: Record<string, number> = {};
    for (const r of runs) reasons[r.terminatedReason] = (reasons[r.terminatedReason] ?? 0) + 1;
    (tierOut.algos as Record<string, unknown>)[algo] = {
      runs: runs.length,
      solved,
      reasons,
      nodesSolvedMedian: nodesSolved.length ? median(nodesSolved) : null,
      nodesWorst: nodesAll[nodesAll.length - 1],
      msMedian: median(msAll),
      msP10: pct(msAll, 10),
      msP90: pct(msAll, 90),
      msWorst: msAll[msAll.length - 1],
    };
    const m = (tierOut.algos as Record<string, any>)[algo];
    console.log(
      `${algo.padEnd(16)} ${tier.padEnd(8)} solved ${String(solved).padStart(3)}/${String(runs.length).padEnd(3)} ` +
        `median ${m.msMedian.toFixed(3).padStart(9)} ms  median_nodes ${m.nodesSolvedMedian}  worst_nodes ${m.nodesWorst}  ${JSON.stringify(reasons)}`,
    );
  }
  (out.tiers as Record<string, unknown>)[tier] = tierOut;
  console.log();
}

mkdirSync(resolve(ROOT, "benchmarks/results"), { recursive: true });
writeFileSync(resolve(HERE, "ts_results.json"), JSON.stringify(out, null, 1));
writeFileSync(resolve(ROOT, "benchmarks/results/solvers_ts.json"), JSON.stringify(out, null, 1));
console.log("-> bench/ts_results.json + benchmarks/results/solvers_ts.json");

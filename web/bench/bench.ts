/**
 * TS solver benchmark. Run: `node bench/bench.ts` (Node >= 22 strips types).
 * Prints median solve time (ms) per algorithm per tier, and writes
 * bench/ts_results.json for the combined Python-vs-TS comparison.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { solve, SOLVERS, type SolverName } from "../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

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
  "bench-hard": readPuzzles("benchmarks/hard.txt"),
};
const ALGOS = Object.keys(SOLVERS) as SolverName[];
const MAX_STEPS = 500_000;
const REPS = 5;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const results: Record<string, Record<string, { medianMs: number; solved: number; n: number }>> = {};

for (const algo of ALGOS) {
  results[algo] = {};
  for (const [tier, puzzles] of Object.entries(TIERS)) {
    // warm-up
    for (const p of puzzles.slice(0, 3)) solve(p, algo, { seed: 0, maxSteps: MAX_STEPS });

    const perPuzzle: number[] = [];
    let solved = 0;
    for (const p of puzzles) {
      const times: number[] = [];
      for (let i = 0; i < REPS; i++) {
        const t = performance.now();
        const r = solve(p, algo, { seed: 0, maxSteps: MAX_STEPS });
        times.push(performance.now() - t);
        if (i === 0 && r.solved) solved++;
      }
      perPuzzle.push(median(times));
    }
    const m = median(perPuzzle);
    results[algo][tier] = { medianMs: m, solved, n: puzzles.length };
    console.log(
      `${algo.padEnd(16)} ${tier.padEnd(11)} median ${m.toFixed(3).padStart(9)} ms   solved ${solved}/${puzzles.length}`,
    );
  }
  console.log();
}

writeFileSync(resolve(HERE, "ts_results.json"), JSON.stringify({ maxSteps: MAX_STEPS, reps: REPS, results }, null, 1));
console.log("-> bench/ts_results.json");

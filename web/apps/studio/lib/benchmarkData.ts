/**
 * Measured numbers for /benchmarks. Every value here comes from a real run:
 *
 *   solvers   — benchmarks/run_solver_bench.py  (Python 3.11) and
 *               web/packages/solver-core/bench/bench.ts  (Node 24), same puzzle
 *               sets, same caps. Node counts cross-checked against the committed
 *               tests/fixtures/solver_reference.json.
 *   CNN       — benchmarks/run_cnn_bench.py  (TensorFlow + OpenCV, 24 fixture
 *               images) and scripts/pick_threshold.py  (deployed ONNX pipeline).
 *
 * Regenerate with those scripts; the JSON they write lives in benchmarks/results/.
 */

export const METHODOLOGY = {
  hardware:
    "Apple silicon laptop (macOS), single-threaded. No other load during the runs.",
  solverRuns:
    "Every puzzle solved once for node counts (deterministic); timing is the median of 3 repetitions, or 1 for runs that hit the cap. min-conflicts is stochastic — 3 seeds (0, 1, 2) per puzzle, so its tier totals are 3× the puzzle count.",
  caps:
    "Backtracking, forward-checking and AC-3 were capped at 1,400,000 search nodes. min-conflicts ran to its own default of 200,000 iterations. Hitting a cap is recorded as a failure, not an error.",
  tracemalloc:
    "Timings are wall-clock with no memory profiler attached. An earlier pass left Python's tracemalloc running and inflated solve times 3.5–4.9×; it was removed. The event emitter is also detached during timing (on_step = None) so the numbers measure the search, not the animation feed.",
  parity:
    "The TypeScript port is checked against the Python reference on 576 rows of (solution, nodes, backtracks, terminated_reason) — identical, including min-conflicts under a CPython-compatible Mersenne Twister. So solve rates and node counts are language-independent; only wall-clock differs.",
  puzzleSets:
    "easy / medium / hard are 30 puzzles each (from puzzles/). extreme is the 12 in benchmarks/hard.txt — AI Escargot, Platinum Blonde, Golden Nugget, Fata Morgana and eight more, seven of them 17-clue minimums.",
} as const;

export type AlgoId = "backtracking" | "forward_checking" | "ac3" | "min_conflicts";
export type Tier = "easy" | "medium" | "hard" | "extreme";

export const ALGO_LABEL: Record<AlgoId, string> = {
  backtracking: "backtracking",
  forward_checking: "forward-checking + MRV",
  ac3: "AC-3",
  min_conflicts: "min-conflicts",
};

export const TIERS: Tier[] = ["easy", "medium", "hard", "extreme"];

/* ---- solve rate: solved / attempts ---- */
export const SOLVE_RATE: Record<AlgoId, Record<Tier, { solved: number; total: number; note?: string }>> = {
  backtracking: {
    easy: { solved: 30, total: 30 },
    medium: { solved: 30, total: 30 },
    hard: { solved: 28, total: 30, note: "2 hit the 1.4M cap" },
    extreme: { solved: 6, total: 12, note: "6 hit the 1.4M cap" },
  },
  forward_checking: {
    easy: { solved: 30, total: 30 },
    medium: { solved: 30, total: 30 },
    hard: { solved: 30, total: 30 },
    extreme: { solved: 12, total: 12 },
  },
  ac3: {
    easy: { solved: 30, total: 30 },
    medium: { solved: 30, total: 30 },
    hard: { solved: 30, total: 30 },
    extreme: { solved: 12, total: 12 },
  },
  min_conflicts: {
    easy: { solved: 85, total: 90, note: "5 timeouts" },
    medium: { solved: 83, total: 90, note: "7 timeouts" },
    hard: { solved: 85, total: 90, note: "5 timeouts" },
    extreme: { solved: 4, total: 36, note: "32 timeouts" },
  },
};

/* ---- search size: median (of solved runs) and worst-case node / iteration
   counts. Median is statistics.median over the Python run; the underlying
   per-puzzle counts are identical in the TypeScript port. ---- */
export const NODE_STATS: Record<AlgoId, Record<Tier, { median: number; worst: number }>> = {
  backtracking: {
    easy: { median: 2025, worst: 254857 },
    medium: { median: 786, worst: 133270 },
    hard: { median: 1931, worst: 1400000 },
    extreme: { median: 176806, worst: 1400000 },
  },
  forward_checking: {
    easy: { median: 56, worst: 183 },
    medium: { median: 59, worst: 412 },
    hard: { median: 63, worst: 149731 },
    extreme: { median: 9903, worst: 44331 },
  },
  ac3: {
    easy: { median: 56, worst: 384 },
    medium: { median: 62, worst: 280 },
    hard: { median: 59, worst: 1235 },
    extreme: { median: 7310, worst: 100560 },
  },
  min_conflicts: {
    easy: { median: 449, worst: 200000 },
    medium: { median: 478, worst: 200000 },
    hard: { median: 847, worst: 200000 },
    extreme: { median: 27191, worst: 200000 },
  },
};

/* ---- timing: median ms per solve, both runtimes ---- */
export interface Timing {
  py: number;
  ts: number;
  pyP90?: number;
  tsP90?: number;
}
export const TIMING: Record<AlgoId, Record<Tier, Timing>> = {
  backtracking: {
    easy: { py: 8.89, ts: 3.24 },
    medium: { py: 5.7, ts: 1.32 },
    hard: { py: 11.98, ts: 5.22 },
    extreme: { py: 5652.99, ts: 1876.94 },
  },
  forward_checking: {
    easy: { py: 1.14, ts: 0.142 },
    medium: { py: 1.42, ts: 0.165 },
    hard: { py: 2.37, ts: 0.252 },
    extreme: { py: 747.04, ts: 43.71 },
  },
  ac3: {
    easy: { py: 18.51, ts: 1.537 },
    medium: { py: 19.41, ts: 1.525 },
    hard: { py: 19.53, ts: 2.287 },
    extreme: { py: 124.36, ts: 56.79 },
  },
  min_conflicts: {
    easy: { py: 68.75, ts: 2.555 },
    medium: { py: 87.16, ts: 3.783 },
    hard: { py: 134.39, ts: 7.057 },
    extreme: { py: 31714.88, ts: 1351.46 },
  },
};

/* ---- CNN digit recognition (benchmarks/results/cnn.json) ---- */
export const CNN = {
  images: 24,
  distinctPuzzles: 16,
  digitCells: 667,
  blankCells: 1277,
  errors: 3,
  perDigitAccuracy: 0.995502,
  detectorErrors: 0,
  detectorCells: 1944,
  gridsExact: 21,
  meanConfCorrect: 0.97,
  meanConfWrong: 0.7805,
  minConfCorrect: 0.4877,
  maxConfWrong: 0.9533,
  /** truth->pred counts; only digits appear (no blanks) */
  confusion: {
    "1->1": 78,
    "2->2": 60,
    "3->3": 77,
    "4->4": 78,
    "4->5": 1,
    "5->5": 83,
    "6->6": 69,
    "7->7": 69,
    "8->8": 87,
    "9->9": 63,
    "9->7": 1,
    "9->8": 1,
  } as Record<string, number>,
  misreads: [
    { image: "11.jpg", cell: "r8c2", was: 9, read: 8, conf: 0.76 },
    { image: "17.jpg", cell: "r8c1", was: 4, read: 5, conf: 0.63 },
    { image: "23.jpg", cell: "r6c4", was: 9, read: 7, conf: 0.95 },
  ],
} as const;

/* ---- preprocessing ablation: per-digit accuracy under each config ---- */
export const ABLATION = [
  { label: "erode + INTER_AREA  (shipped)", accuracy: 0.995502, errors: 3, shipped: true },
  { label: "no erode, INTER_AREA", accuracy: 0.932534, errors: 45 },
  { label: "erode, INTER_NEAREST", accuracy: 0.917541, errors: 55 },
  { label: "no erode, INTER_NEAREST", accuracy: 0.886057, errors: 76 },
] as const;
export const ABLATION_DELTAS = {
  erode: 6.30,
  interpolation: 7.80,
  both: 10.94,
} as const;

/* ---- confidence-threshold sweep (scripts/pick_threshold.py) ----
   FP = a correct cell flagged (false alarm); FN = a wrong cell NOT flagged (miss).
   667 correct cells, 3 wrong. */
export const THRESHOLD_SWEEP = [
  { threshold: 0.7, flagged: 10, fp: 9, fpPct: 1.36, fn: 2, fnPct: 66.67 },
  { threshold: 0.75, flagged: 15, fp: 14, fpPct: 2.11, fn: 2, fnPct: 66.67 },
  { threshold: 0.8, flagged: 22, fp: 20, fpPct: 3.01, fn: 1, fnPct: 33.33 },
  { threshold: 0.85, flagged: 32, fp: 30, fpPct: 4.52, fn: 1, fnPct: 33.33 },
  { threshold: 0.88, flagged: 47, fp: 45, fpPct: 6.78, fn: 1, fnPct: 33.33 },
  { threshold: 0.9, flagged: 58, fp: 56, fpPct: 8.43, fn: 1, fnPct: 33.33 },
  { threshold: 0.92, flagged: 89, fp: 87, fpPct: 13.1, fn: 1, fnPct: 33.33 },
  { threshold: 0.95, flagged: 130, fp: 128, fpPct: 19.28, fn: 1, fnPct: 33.33 },
  { threshold: 0.97, flagged: 175, fp: 172, fpPct: 25.9, fn: 0, fnPct: 0 },
] as const;
export const CHOSEN_THRESHOLD = 0.85;

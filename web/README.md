# @sudoku/solver-core

Zero-dependency TypeScript port of the four Python solvers
(`solvers/` in the repo root), validated **row-for-row** against
`tests/fixtures/solver_reference.json`.

Usable unchanged from a Web Worker, a Node script, or a React app.

```ts
import { solve, SOLVERS } from "@sudoku/solver-core";

const r = solve(puzzle /* 81 chars, "0"/"." = blank */, "ac3", { maxSteps: 200_000 });
r.solution;          // 81-char string, or null
r.solved;            // boolean
r.nodes; r.backtracks; r.runtimeMs;
r.terminatedReason;  // "solved" | "exhausted" | "no_solution" | "max_steps"
```

| name | algorithm | notes |
|---|---|---|
| `backtracking` | plain DFS + peer candidate filtering | Algo1 |
| `forward_checking` | backtracking + forward checking + MRV | Algo2 |
| `ac3` | AC-3 propagation, then MRV/LCV/FC backtracking | Algo3 |
| `min_conflicts` | min-conflicts local search | Algo4; stochastic, takes `seed` |

## Step events

`solve(puzzle, algo, { onStep, maxEvents })` streams structured events
(schema in `../solvers/EVENT_SCHEMA.md`; the objects are byte-identical to the
Python side so one renderer consumes either backend). `maxEvents` samples them
evenly; omitting `onStep` is near-zero cost.

## Web Worker

```ts
import { SolverClient } from "@sudoku/solver-core/worker";

const client = new SolverClient(() =>
  new Worker(new URL("@sudoku/solver-core/worker-entry", import.meta.url), { type: "module" }),
);

const run = client.run(puzzle, "ac3", { maxSteps: 200_000, flushMs: 16 }, (batch) => {
  for (const ev of batch) render(ev);          // events arrive time-batched
});
const result = await run.result;               // or: run.cancel()
```

Event flushing is **time-based** (`flushMs`, default 16) — polled inside the
`onStep` callback because `solve()` is synchronous, so a fast solve produces one
flush and a slow one flushes every `flushMs`, never a message per event.

`cancel()` is **cooperative** where `SharedArrayBuffer` is available (the worker
polls a flag and stops mid-solve, staying reusable) and falls back to
`worker.terminate()` + respawn after `graceMs` otherwise.

## min_conflicts RNG

`min_conflicts` uses a CPython-compatible **MT19937** (`src/rng/mt19937.ts`) so a
given seed reproduces the Python run exactly — `_randbelow` rejection sampling,
`shuffle` (Fisher-Yates descending) and `choice` all match. Verified against
generated CPython 3.11 vectors.

## Scripts

```
npm test           # vitest: MT vectors, parity (576 rows), event-stream parity, worker
npm run typecheck  # tsc --noEmit, strict
npm run build      # -> dist/
npm run bench      # node bench/bench.ts  (needs npm run build first)
```

# sudoku-solver

Read a Sudoku from a photo with a CNN, then watch four different algorithms solve
it — backtracking, forward-checking, AC-3, and min-conflicts — side by side, with
live node and backtrack counts.

**Live demo:** _https://TODO — placeholder_

The project has two halves: a Python side (the four solvers as an instrumented
package, plus the CNN recognition pipeline) and a web side (a TypeScript port of
the solvers running in Web Workers, behind a Next.js frontend). Both are driven
from the same measured data — the `/benchmarks` page and the numbers below all
come from re-running the code, not from the original report.

---

## Provenance

This began as a six-person coursework project for **CSCI323 at the University of
Wollongong**. In that project I owned the basic backtracking solver and the
end-to-end integration that wired the CNN output into the CSP solvers.

The starting points, all credited in [Sources](#sources) below:

| component | adapted from |
|---|---|
| backtracking (Algo 1) | CharKeaney/sudoku-solver |
| forward-checking + MRV (Algo 2) | paccionesawyer/sudokuSolver-CSP |
| AC-3 + backtracking (Algo 3) | stressGC/Python-AC3-Backtracking-CSP-Sudoku-Solver |
| min-conflicts (Algo 4) | Minton et al. 1992; kushjain/Min-Conflicts |
| CV pipeline + digit CNN | PyImageSearch OpenCV Sudoku tutorial; rg1990/cv-sudoku-solver |

**Everything below this line is solo work done after the coursework submission.**

---

## What I built

### Correctness

**Algorithm 2 was a copy of Algorithm 1.** The file labelled "Forward Checking +
MRV" ran plain backtracking — the real forward-checking implementation was in the
repo but was never imported. The original report published identical node counts
for both algorithms without noticing. After rewiring it to the actual
implementation, median node counts on typical puzzles dropped from **~2,000 to
~56**.

**Train/inference normalization mismatch in the CNN.** Training divided pixel
values by 255; inference did not. This cost about 0.6 percentage points of
accuracy, but the real damage was to confidence calibration — the model reported
~100% confidence even on wrong predictions. After fixing it, wrong predictions
average **0.78 confidence**, which is what makes the low-confidence review flag on
the `/verify` screen meaningful.

**Timing was inflated 3.5–4.9×.** All previously reported runtimes were measured
with `tracemalloc` active in the timing path. Removed it; re-measured everything.

### Measurement

There was no ground-truth evaluation set and no measured accuracy number. I built
one: **24 photographed grids, each transcribed by hand and validated to be a
legal Sudoku with a unique solution.** First measured accuracy: **99.55%
per-digit across 667 digit cells**, 0 blank-vs-digit detector errors across 1,944
cells.

From there:

- **Preprocessing ablation** — erosion is worth 6.3pp of accuracy, `INTER_AREA`
  vs `INTER_NEAREST` for the cell resize is worth 7.8pp.
- **Confusion matrix** — every misread is a `9` read as a 7 or 8, except one `4`
  read as a 5. The digit 9 is the only one below 100% (96.9%).
- **Confidence threshold** — chosen at 0.85 from a documented sweep (0.70→0.97),
  trading a 4.5% false-alarm rate for catching 2 of 3 fixture misreads; the third
  is a confident misread on a blurred photo that only the Sudoku-legality check
  catches.

### Refactor

The four solvers were standalone scripts with module-level state, `print`
debugging, and unseeded RNG. I refactored them into **one importable package
(`solvers/`)** with:

- a uniform `solve(puzzle, algorithm, *, seed, max_steps, max_events, on_step)`
  interface returning a structured result;
- no global state — safe to run concurrently in threads;
- seeded RNG threaded through min-conflicts so a seed reproduces a run exactly;
- a structured **step-event stream** (`assign`, `unassign`, `eliminate`,
  `ac3_revise`, …) for animating the search, with even sampling via `max_events`
  and near-zero cost when unused.

### TypeScript port

All four solvers ported to a **zero-dependency TypeScript package**
(`web/packages/solver-core/`) that runs unchanged in a Web Worker, Node, or the
browser. Parity with the Python reference is verified exactly:

- **576 / 576** reference rows — solution, node count, backtrack count,
  termination reason — identical;
- **76,074 / 76,074** streamed events identical across 32 solve streams.

Keeping min-conflicts seed-identical meant reimplementing **CPython's MT19937**,
including `random._randbelow`'s rejection sampling, so
`random.Random(seed).shuffle` produces the same sequence in both languages.

### Deployable inference

The CNN was a Keras model that pulled in TensorFlow (hundreds of MB). Converted
it to **ONNX (0.9 MB)** with the `/255` rescaling baked in, verified numerically
equivalent, and built a **TensorFlow-free inference API** (`api/`) — OpenCV +
`onnxruntime`, a stdlib HTTP handler, the model loaded once at import.

### Frontend

`web/apps/studio/` — a Next.js app: upload a photo or pick a puzzle, review the
recognised grid, then run one algorithm with playback controls or race all four
at once, each in its own Worker. Plus the `/benchmarks` page. No component
library; the solver package is imported directly through an npm workspace.

---

## What it does

**Recognition** — `POST` a photo to the inference API and get back an 81-character
grid, per-cell confidences, and the indices of low-confidence or rule-violating
cells. Grid-not-found is a normal 422 response, not a crash.

**Solving** — four algorithms behind one interface, in Python or TypeScript:

| name | technique |
|---|---|
| `backtracking` | depth-first search with peer candidate filtering |
| `forward_checking` | backtracking + forward checking + minimum-remaining-values ordering |
| `ac3` | AC-3 constraint propagation, then MRV/LCV backtracking |
| `min_conflicts` | min-conflicts local search (stochastic, seeded) |

**Studio** — the grid is the centre of every screen. Single mode plays one
algorithm's search with play/pause/step/speed controls and a live explainer;
race mode runs all four on one puzzle simultaneously. Backtracking emits only
`assign`/`unassign`, so it visibly gropes while the others visibly reason — that
contrast is the point.

**Benchmarks** — `/benchmarks` presents the measured performance: solve rates
(backtracking clears 6/12 of the hardest set, min-conflicts 4/36), node counts
from 56 to 1.4M on a log scale, TypeScript-vs-Python timing (2–27×), and the CNN
accuracy / confusion / ablation / threshold data. Methodology is stated on the
page.

## Run it locally

Requires Python 3.9+ and Node 20+ (Node 22+ to run `bench.ts` directly).

### Solvers (Python, no ML dependencies)

```bash
pip install -r requirements.txt
python -m solvers.cli ac3 puzzles/easy.txt puzzles/medium.txt
python -m solvers.cli backtracking benchmarks/hard.txt --timeout 30
```

```python
from solvers import solve
r = solve(puzzle_string, "forward_checking", max_steps=100_000)
r.solution, r.solved, r.nodes, r.backtracks, r.runtime_ms
```

### Inference API

```bash
pip install -r requirements.txt          # numpy, onnxruntime, opencv-headless
python api/dev_server.py                  # http://localhost:8000/api
curl -s --data-binary @tests/fixtures/images/1.jpg \
     -H 'Content-Type: image/jpeg' http://localhost:8000/api | python -m json.tool
```

`api/requirements.txt` is the minimal set Vercel installs (no TensorFlow).
`requirements-dev.txt` adds TensorFlow / Keras / tf2onnx for retraining and
exporting the model (`scripts/export_model.py`, `cnn/train.py`).

### Frontend

```bash
cd web
npm install
npm run build:core                       # compile the solver package
npm run dev                               # http://localhost:3001
```

Set `NEXT_PUBLIC_INFERENCE_API` to point the upload flow at a deployed API; it
defaults to `http://localhost:8000/api`.

---

## Architecture

```
solvers/              Python solver package — uniform interface, no global state,
                      seeded RNG, step-event streaming
harness/              dumps reference output (solution, counts, events) for the port
tests/                pytest suite; tests/fixtures/ holds the 24-grid eval set
benchmarks/           puzzle sets, benchmark scripts, results/ JSON

cnn/                  Keras training (train.py) + the reference CV pipeline
                      (sudoku_utils.py) used by the accuracy regression test
api/                  TensorFlow-free inference API: OpenCV + ONNX, Vercel handler,
                      dev_server.py; model loaded once at import

web/packages/solver-core/   TypeScript port of the four solvers; zero deps;
                            SolverClient Web Worker wrapper with event batching
web/apps/studio/            Next.js frontend (input / verify / solve / benchmarks)
```

`api/_pipeline.py` re-implements `cnn/sudoku_utils.py`'s grid detection and cell
segmentation without TensorFlow; `tests/test_cv_pipeline_parity.py` asserts the
two produce identical cells on every fixture so the deployed path can't drift
from the tested one.

Data flows one direction: `harness/` freezes Python behaviour into
`tests/fixtures/solver_reference.json`, and the TypeScript package's test suite
diffs against it. The event objects are byte-identical across the two languages,
so one renderer consumes either backend.

---

## Tests

| suite | count | covers |
|---|---|---|
| `pytest` | 42 | solver correctness, determinism, event schema, inference API, CV-pipeline parity |
| `web/packages/solver-core` (vitest) | 77 | port correctness, MT19937, Worker wrapper |
| `web/apps/studio` (vitest) | 55 | grid editing, legality checks, benchmark-data consistency |
| parity harness | 576 rows + 76,074 events | Python ↔ TypeScript, exact |

```bash
pytest                                    # Python solver + API suite
npm test --prefix web                     # both vitest suites
pytest -m slow                            # full parity + hard-puzzle runs (minutes)
```

Two pytest tests need the dev extras (`pip install -r requirements-dev.txt`) —
the CNN accuracy regression and the CV-pipeline parity check both drive the
Keras pipeline. They skip cleanly without TensorFlow.

---

## Sources

Backtracking — https://github.com/CharKeaney/sudoku-solver ·
Forward-checking — https://github.com/paccionesawyer/sudokuSolver-CSP ·
AC-3 — https://github.com/stressGC/Python-AC3-Backtracking-CSP-Sudoku-Solver ·
Min-conflicts — https://doi.org/10.1016/0004-3702(92)90007-K ,
https://github.com/kushjain/Min-Conflicts ·
CNN / CV — https://github.com/rg1990/cv-sudoku-solver ,
https://pyimagesearch.com/2020/08/10/opencv-sudoku-solver-and-ocr/

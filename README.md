# sudoku-solver

Four Sudoku solvers behind one importable, instrumentable interface, plus a
CNN photo -> grid recogniser.

## Solvers

```python
from solvers import solve, SOLVERS          # SOLVERS: backtracking, forward_checking, ac3, min_conflicts

r = solve(puzzle_string, "ac3", max_steps=200_000)
r.solution        # 81-char solved grid, or None
r.solved          # bool
r.nodes, r.backtracks, r.runtime_ms
r.terminated_reason   # "solved" | "exhausted" | "no_solution" | "max_steps"
```

`puzzle_string` is 81 characters, `0` or `.` for blanks.

| name | algorithm |
|---|---|
| `backtracking` | plain DFS with peer-based candidate filtering (Algo1) |
| `forward_checking` | backtracking + forward checking + MRV (Algo2) |
| `ac3` | AC-3 constraint propagation, then backtracking with MRV / LCV / FC (Algo3) |
| `min_conflicts` | min-conflicts local search; stochastic, takes `seed=` (Algo4) |

### Step events (animating the search)

Pass `on_step` to receive structured events (`solvers/events.py` documents the
schema); pass `max_events` to sample them evenly:

```python
solve(puzzle, "forward_checking", on_step=print, max_steps=100_000, max_events=5000)
```

Events are near-zero cost when `on_step` is `None`.

### CLI

```
python -m solvers.cli ac3 puzzles/easy.txt puzzles/medium.txt
python -m solvers.cli backtracking benchmarks/hard.txt --timeout 30
python -m solvers.cli min_conflicts puzzles/hard.txt --repeats 5 --seed 0 --csv out.csv
```

The CLI owns tabulate / CSV / timeouts; none of that is on the `import solvers`
path.

### Reference harness (for the TypeScript port)

```
python -m harness.reference puzzles/easy.txt puzzles/hard.txt -o ref.json
```

Dumps `(solution, solved, nodes, backtracks, terminated_reason)` per puzzle plus
a SHA-256 digest.

### Puzzle sets

* `puzzles/{easy,medium,hard}.txt` - 30 puzzles each
* `benchmarks/hard.txt` - 12 known-hard puzzles (10 are 17-clue), see
  `benchmarks/README.md`

## CNN recogniser

```
python sudoku_main.py --img_fpath "../../tests/fixtures/images/2.jpg" --output_path "recognized_sudoku.txt"
python sudoku_integrated_solver.py --image tests/fixtures/images/external1.jpg
```

Regression fixtures and baseline accuracy live in `tests/fixtures/`.

## Tests

```
pip install -r requirements.txt      # or: pip install pytest tabulate
pytest                               # solver suite (no TF/OpenCV needed)
```

`tests/test_cnn_recognition.py` is skipped unless tensorflow / opencv are
installed.

## Sources

Algo1 https://github.com/CharKeaney/sudoku-solver ·
Algo2 https://github.com/paccionesawyer/sudokuSolver-CSP ·
Algo3 https://github.com/stressGC/Python-AC3-Backtracking-CSP-Sudoku-Solver ·
Algo4 https://doi.org/10.1016/0004-3702(92)90007-K , https://github.com/kushjain/Min-Conflicts ·
CNN https://github.com/rg1990/cv-sudoku-solver , https://pyimagesearch.com/2020/08/10/opencv-sudoku-solver-and-ocr/

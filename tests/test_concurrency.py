"""8 solves running simultaneously in threads must not interfere.

Regression guard for the Algo1 module-global grid (`values`) and the Algo3
per-instance domains: a shared mutable would show up here as a wrong or
missing solution."""
import concurrent.futures as cf

from solvers import SOLVERS, solve
from solvers.base import is_solved_string


def _expected(puzzles, algo):
    return [solve(p, algo, seed=0).solution for p in puzzles]


def test_eight_concurrent_solves(puzzle_sets):
    # a spread of puzzles, one per worker (kept off the slow tier so
    # min_conflicts stays quick)
    puzzles = puzzle_sets["easy"][:4] + puzzle_sets["medium"][:4]
    assert len(puzzles) == 8

    for algo in SOLVERS:
        serial = _expected(puzzles, algo)
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            futs = [ex.submit(solve, p, algo, seed=0, max_steps=2_000_000)
                    for p in puzzles]
            results = [f.result() for f in futs]

        for i, r in enumerate(results):
            if algo == "min_conflicts":
                # stochastic but seeded: identical to the serial run
                assert r.solution == serial[i], (algo, i)
            else:
                assert r.solution == serial[i], (algo, i)
            if r.solved:
                assert is_solved_string(r.solution)


def test_concurrent_stress_single_algo(puzzle_sets):
    """Many threads, one hard puzzle each, backtracking (the ex-global one)."""
    p = puzzle_sets["hard"][0]
    want = solve(p, "backtracking").solution
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        outs = [f.result() for f in
                [ex.submit(solve, p, "backtracking") for _ in range(16)]]
    assert all(o.solution == want for o in outs)
    assert all(o.nodes == outs[0].nodes for o in outs)

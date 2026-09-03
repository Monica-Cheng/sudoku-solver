"""Every solver produces valid solutions that keep the givens; the systematic
solvers agree on puzzles that have a unique solution."""
import pytest

from solvers import SOLVERS, solve
from solvers.base import is_solved_string
from solvers.events import TERMINATED_REASONS

DETERMINISTIC = ["backtracking", "forward_checking", "ac3"]
MAX_STEPS = 500_000

# minimum #solved out of 30, at MAX_STEPS (Phase 1 observations)
MIN_SOLVED = {
    ("backtracking", "easy"): 30, ("backtracking", "medium"): 30, ("backtracking", "hard"): 28,
    ("forward_checking", "easy"): 30, ("forward_checking", "medium"): 30, ("forward_checking", "hard"): 29,
    ("ac3", "easy"): 30, ("ac3", "medium"): 30, ("ac3", "hard"): 30,
    ("min_conflicts", "easy"): 27, ("min_conflicts", "medium"): 26, ("min_conflicts", "hard"): 27,
}


def _check_tier(algo, tier, puzzles):
    solved = 0
    for p in puzzles:
        r = solve(p, algo, seed=0, max_steps=MAX_STEPS)
        if r.solved:
            solved += 1
            assert is_solved_string(r.solution), (algo, tier)
            assert all(p[k] == "0" or p[k] == r.solution[k] for k in range(81)), \
                "solution must keep the givens"
        else:
            assert r.terminated_reason in {"max_steps", "exhausted"}
    assert solved >= MIN_SOLVED[(algo, tier)], (algo, tier, solved)


@pytest.mark.parametrize("algo", list(SOLVERS))
def test_solvers_solve_easy(algo, puzzle_sets):
    _check_tier(algo, "easy", puzzle_sets["easy"])


@pytest.mark.slow
@pytest.mark.parametrize("algo", list(SOLVERS))
@pytest.mark.parametrize("tier", ["medium", "hard"])
def test_solvers_solve_medium_hard(algo, tier, puzzle_sets):
    _check_tier(algo, tier, puzzle_sets[tier])


def test_deterministic_solvers_agree_on_unique_puzzles(bench_hard):
    """benchmarks/hard.txt puzzles have exactly one solution, so the three
    systematic solvers must return the same grid. The easy/medium/hard sets
    contain under-constrained puzzles with several valid completions, so
    cross-solver agreement is not expected there (only that each solution is
    valid and keeps the givens, checked above)."""
    for p in bench_hard:
        sols = {a: solve(p, a, max_steps=500_000).solution for a in DETERMINISTIC}
        # forward_checking and ac3 finish every bench-hard puzzle; plain
        # backtracking blows past the node budget on the 17-clue ones.
        finished = {a: s for a, s in sols.items() if s}
        assert {"forward_checking", "ac3"} <= set(finished), sols
        assert len(set(finished.values())) == 1, sols


def test_terminated_reasons_are_in_the_enum():
    for a in SOLVERS:
        for ms in (10, 500, None):
            r = solve("0" * 81, a, seed=1, max_steps=ms)
            assert r.terminated_reason in TERMINATED_REASONS


def test_no_solution_detected():
    bad = "11" + "0" * 79  # two 1s in row 1
    r = solve(bad, "ac3")
    assert not r.solved and r.terminated_reason == "no_solution"


def test_max_steps_stops_deterministically():
    p = "000000010400000000020000000000050407008000300001090000300400200050100000000806000"
    a = solve(p, "backtracking", max_steps=1234)
    b = solve(p, "backtracking", max_steps=1234)
    assert a.terminated_reason == "max_steps" and a.nodes == 1234
    assert (a.nodes, a.backtracks, a.solution) == (b.nodes, b.backtracks, b.solution)

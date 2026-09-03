"""min_conflicts: same seed -> identical run; the seed is reported; a fresh
seed is used when none is given."""
from solvers import solve


def test_same_seed_reproduces(puzzle_sets):
    p = puzzle_sets["hard"][3]
    a = solve(p, "min_conflicts", seed=12345, max_steps=50_000)
    b = solve(p, "min_conflicts", seed=12345, max_steps=50_000)
    assert (a.solution, a.solved, a.nodes, a.backtracks) == \
           (b.solution, b.solved, b.nodes, b.backtracks)
    assert a.seed == b.seed == 12345


def test_different_seed_diverges(easy):
    # over a handful of easy puzzles at least one seed pair should differ in
    # node count (they are stochastic runs)
    diffs = 0
    for p in easy[:8]:
        n0 = solve(p, "min_conflicts", seed=0, max_steps=50_000).nodes
        n1 = solve(p, "min_conflicts", seed=1, max_steps=50_000).nodes
        diffs += (n0 != n1)
    assert diffs >= 1


def test_seed_none_is_recorded_and_varies(easy):
    p = easy[0]
    seeds = {solve(p, "min_conflicts").seed for _ in range(5)}
    assert all(isinstance(s, int) for s in seeds)
    assert len(seeds) > 1  # a fresh random seed each call


def test_deterministic_solvers_ignore_seed(easy):
    p = easy[0]
    for algo in ("backtracking", "forward_checking", "ac3"):
        r1 = solve(p, algo, seed=1)
        r2 = solve(p, algo, seed=999)
        assert (r1.solution, r1.nodes, r1.backtracks) == (r2.solution, r2.nodes, r2.backtracks)
        assert r1.seed is None

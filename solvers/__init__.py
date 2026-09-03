"""Importable, instrumentable Sudoku solvers.

    from solvers import solve, SOLVERS, SolveResult

    result = solve("00030...", "ac3", max_steps=100_000)
    for name in SOLVERS:                       # "backtracking", "forward_checking",
        solve(puzzle, name, on_step=print)     # "ac3", "min_conflicts"

Every solver exposes the same signature:

    solve(puzzle: str, *, on_step=None, seed=None,
          max_steps=None, max_events=None) -> SolveResult

See solvers.base.SolveResult and solvers.events for the event schema.
"""
from .backtracking import solve as _bt
from .forward_checking import solve as _fc
from .ac3 import solve as _ac3
from .min_conflicts import solve as _mc
from .base import SolveResult, normalize_puzzle
from . import events

__all__ = ["solve", "SOLVERS", "SolveResult", "events", "normalize_puzzle"]

SOLVERS = {
    "backtracking": _bt,
    "forward_checking": _fc,
    "ac3": _ac3,
    "min_conflicts": _mc,
}

# friendly aliases
_ALIASES = {
    "algo1": "backtracking", "bt": "backtracking",
    "algo2": "forward_checking", "fc": "forward_checking",
    "algo3": "ac3",
    "algo4": "min_conflicts", "mc": "min_conflicts", "min-conflicts": "min_conflicts",
}


def solve(puzzle: str, algorithm: str, *, on_step=None, seed=None,
          max_steps=None, max_events=None) -> SolveResult:
    key = _ALIASES.get(algorithm, algorithm)
    if key not in SOLVERS:
        raise ValueError(f"unknown algorithm {algorithm!r}; "
                         f"choose from {sorted(SOLVERS)}")
    return SOLVERS[key](puzzle, on_step=on_step, seed=seed,
                        max_steps=max_steps, max_events=max_events)

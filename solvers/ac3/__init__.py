"""Algo3: AC-3 + backtracking (MRV + LCV + forward checking)."""
from ..base import SolveResult, finish, make_sampler, normalize_puzzle, timed
from .core import ALGORITHM_NAME, search

__all__ = ["solve", "ALGORITHM_NAME"]


def solve(puzzle: str, *, on_step=None, seed=None, max_steps=None,
          max_events=None) -> SolveResult:
    p = normalize_puzzle(puzzle)
    sampler = make_sampler(on_step, max_events, max_steps)
    result, ms = timed(lambda: search(p, sampler, max_steps))
    solution, solved, nodes, backtracks, reason, extra = result
    return finish((solution, solved, nodes, backtracks, reason),
                  ALGORITHM_NAME, ms, sampler, extra=extra)

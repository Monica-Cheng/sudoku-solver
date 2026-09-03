"""Algo1: plain recursive backtracking."""
from ..base import SolveResult, finish, make_sampler, normalize_puzzle, timed
from .core import ALGORITHM_NAME, search

__all__ = ["solve", "ALGORITHM_NAME"]


def solve(puzzle: str, *, on_step=None, seed=None, max_steps=None,
          max_events=None) -> SolveResult:
    p = normalize_puzzle(puzzle)
    sampler = make_sampler(on_step, max_events, max_steps)
    result, ms = timed(lambda: search(p, sampler, max_steps))
    return finish(result, ALGORITHM_NAME, ms, sampler)

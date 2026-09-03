"""Algo4: min-conflicts local search (stochastic; honours `seed`)."""
from ..base import SolveResult, finish, make_sampler, normalize_puzzle, timed
from .core import ALGORITHM_NAME, DEFAULT_MAX_STEPS, search

__all__ = ["solve", "ALGORITHM_NAME", "DEFAULT_MAX_STEPS"]


def solve(puzzle: str, *, on_step=None, seed=None, max_steps=None,
          max_events=None) -> SolveResult:
    p = normalize_puzzle(puzzle)
    budget = max_steps if max_steps is not None else DEFAULT_MAX_STEPS
    sampler = make_sampler(on_step, max_events, budget)
    result, ms = timed(lambda: search(p, sampler, max_steps, seed))
    solution, solved, nodes, backtracks, reason, used_seed = result
    return finish((solution, solved, nodes, backtracks, reason),
                  ALGORITHM_NAME, ms, sampler, seed=used_seed)

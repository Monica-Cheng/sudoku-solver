"""Shared result type and the uniform ``solve`` contract.

    solve(puzzle: str, *, on_step=None, seed=None, max_steps=None,
          max_events=None) -> SolveResult

* ``puzzle``      81 chars, '0' or '.' for blanks.
* ``on_step``     optional ``Callable[[dict], None]``; receives step events
                  (see solvers.events). None -> no events, near-zero overhead.
* ``seed``        only meaningful for the stochastic solver (min_conflicts);
                  ignored by the deterministic ones. None -> a fresh random seed.
* ``max_steps``   cap on primary work (search nodes / iterations / arc
                  revisions). None -> no cap. Hitting it stops the solver with
                  terminated_reason="max_steps".
* ``max_events``  cap on events delivered to on_step (evenly sampled). Requires
                  on_step. None -> every event is delivered.

There is deliberately no ``timed_out`` field: the Phase 0 audit found it was
plumbed through all four runners but never enforced. ``max_steps`` replaces it
with something deterministic and reproducible.
"""
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

from .sampler import StepSampler

PUZZLE_LEN = 81
_DIGITS = set("123456789")


@dataclass
class SolveResult:
    solution: Optional[str]          # 81-char solved grid, or None
    solved: bool
    runtime_ms: float
    nodes: int                       # search nodes / iterations visited
    backtracks: int
    steps_emitted: int               # events delivered to on_step
    algorithm_name: str
    terminated_reason: str           # solvers.events.TERMINATED_REASONS
    seed: Optional[int] = None       # the seed actually used (min_conflicts)
    extra: dict = field(default_factory=dict)


def normalize_puzzle(puzzle: str) -> str:
    """Validate and canonicalise: accept '.' as blank, return 81 chars of 0-9."""
    if not isinstance(puzzle, str):
        raise TypeError(f"puzzle must be str, got {type(puzzle).__name__}")
    p = puzzle.strip().replace(".", "0")
    if len(p) != PUZZLE_LEN or any(c not in "0123456789" for c in p):
        raise ValueError(f"puzzle must be {PUZZLE_LEN} chars of 0-9/., got {len(p)!r}")
    return p


def make_sampler(on_step: Optional[Callable], max_events, max_steps):
    """None when on_step is None -> the solver skips all event machinery."""
    if on_step is None:
        return None
    return StepSampler(on_step, max_events=max_events, max_steps=max_steps)


def finish(search_result, algorithm_name, runtime_ms, sampler, seed=None, extra=None):
    """Assemble a SolveResult from a solver core's
    (solution, solved, nodes, backtracks, terminated_reason) tuple."""
    solution, solved, nodes, backtracks, reason = search_result
    return SolveResult(
        solution=solution,
        solved=solved,
        runtime_ms=runtime_ms,
        nodes=nodes,
        backtracks=backtracks,
        steps_emitted=sampler.delivered if sampler is not None else 0,
        algorithm_name=algorithm_name,
        terminated_reason=reason,
        seed=seed,
        extra=extra or {},
    )


def timed(fn):
    """Run fn(), return (result, elapsed_ms). No tracemalloc: it is
    process-global and inflates the very timings it measures."""
    t0 = time.perf_counter()
    result = fn()
    return result, (time.perf_counter() - t0) * 1000.0


def is_solved_string(s: Optional[str]) -> bool:
    if not s or len(s) != PUZZLE_LEN or "0" in s:
        return False
    g = [s[i:i + 9] for i in range(0, 81, 9)]
    for i in range(9):
        if set(g[i]) != _DIGITS:
            return False
        if {g[r][i] for r in range(9)} != _DIGITS:
            return False
    for br in range(0, 9, 3):
        for bc in range(0, 9, 3):
            box = {g[br + i][bc + j] for i in range(3) for j in range(3)}
            if box != _DIGITS:
                return False
    return True

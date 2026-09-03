"""Callback events: structurally valid, reference legal cells/values, bounded
by max_events, and near-zero cost when on_step is None."""
import time

import pytest

from solvers import SOLVERS, events, solve

DIGITS = set("123456789")


def _collect(puzzle, algo, **kw):
    evs = []
    r = solve(puzzle, algo, on_step=evs.append, **kw)
    return r, evs


@pytest.mark.parametrize("algo", list(SOLVERS))
def test_events_are_structurally_valid(algo, puzzle_sets):
    p = puzzle_sets["medium"][0]
    r, evs = _collect(p, algo, seed=0, max_steps=200_000)
    assert evs, "expected at least start/stopped"
    for ev in evs:
        assert events.is_valid_event(ev), ev
    assert evs[0]["type"] == events.START
    assert evs[-1]["type"] in (events.SOLVED, events.STOPPED)
    assert r.steps_emitted == sum(1 for e in evs if e["type"] not in events.LIFECYCLE)


@pytest.mark.parametrize("algo", list(SOLVERS))
def test_event_cells_and_values_are_legal(algo, puzzle_sets):
    p = puzzle_sets["medium"][1]
    _, evs = _collect(p, algo, seed=0, max_steps=200_000)
    for ev in evs:
        for key in ("cell", "cell_a", "cell_b", "by"):
            if key in ev and ev[key] is not None:
                assert 0 <= ev[key] <= 80, ev
        for key in ("value", "value_a", "value_b"):
            if key in ev:
                assert 1 <= ev[key] <= 9, ev
        if ev["type"] == events.AC3_REVISE:
            assert all(0 <= c <= 80 for c in ev["arc"])
            assert all(1 <= v <= 9 for v in ev["removed"])


def test_assign_targets_a_blank_cell(puzzle_sets):
    """An assign/swap/reassign never targets a given."""
    p = puzzle_sets["hard"][0]
    for algo in SOLVERS:
        _, evs = _collect(p, algo, seed=0, max_steps=200_000)
        for ev in evs:
            if ev["type"] in (events.ASSIGN, events.REASSIGN):
                assert p[ev["cell"]] == "0", (algo, ev)
            if ev["type"] == events.SWAP:
                assert p[ev["cell_a"]] == "0" and p[ev["cell_b"]] == "0", (algo, ev)


@pytest.mark.parametrize("algo", ["backtracking", "forward_checking", "ac3"])
def test_max_events_caps_delivery(algo, puzzle_sets):
    p = puzzle_sets["hard"][14]  # a puzzle that makes each solver work
    cap = 500
    r, evs = _collect(p, algo, max_steps=100_000, max_events=cap)
    non_life = [e for e in evs if e["type"] not in events.LIFECYCLE]
    assert len(non_life) <= cap
    assert r.steps_emitted <= cap
    # steps are the true tick ordinals (monotonic non-decreasing)
    steps = [e["step"] for e in non_life]
    assert steps == sorted(steps)


@pytest.mark.parametrize("algo", list(SOLVERS))
def test_callback_overhead_is_small(algo, puzzle_sets):
    p = puzzle_sets["hard"][0]
    n = 5
    t0 = time.perf_counter()
    for _ in range(n):
        solve(p, algo, seed=0, max_steps=200_000)
    base = time.perf_counter() - t0

    t0 = time.perf_counter()
    for _ in range(n):
        solve(p, algo, seed=0, max_steps=200_000, on_step=lambda e: None,
              max_events=1)  # deliver ~nothing, but the emit path is live
    live = time.perf_counter() - t0

    # a live-but-sampled-out callback must stay within 2x of no callback
    assert live < base * 2 + 0.05, (algo, base, live)

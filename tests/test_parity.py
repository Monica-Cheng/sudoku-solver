"""Parity with the Phase 1 baseline.

tests/fixtures/solver_reference.json holds (solution, solved, nodes,
backtracks, terminated_reason) for every solver on easy/medium/hard (plus
bench-hard for the fast solvers, and min_conflicts at fixed seeds), captured
from the refactored package and cross-checked against the original
Algo*/*_run.py by scratch/parity.py.

If a solver's search behaviour changes, this test fails with the exact
(set, index, algorithm, seed) that diverged.
"""
import json
import os

import pytest

from solvers import solve

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "solver_reference.json")


def _check(rows, max_steps_default):
    diffs = []
    for row in rows:
        r = solve(row["puzzle"], row["algorithm"],
                  seed=row["seed"], max_steps=row.get("max_steps", max_steps_default))
        got = (r.solution, r.solved, r.nodes, r.backtracks, r.terminated_reason)
        exp = (row["solution"], row["solved"], row["nodes"], row["backtracks"],
               row["terminated_reason"])
        if got != exp:
            diffs.append((row["set"], row["index"], row["algorithm"], row["seed"], exp, got))
    assert not diffs, "\n".join(
        f"{s}#{i} {a} seed={sd}\n  ref={e}\n  got={g}" for s, i, a, sd, e, g in diffs[:20]
    )


@pytest.mark.skipif(not os.path.exists(FIX), reason="reference fixture not generated")
def test_matches_reference_deterministic():
    ref = json.load(open(FIX))
    rows = [r for r in ref["rows"] if r["algorithm"] != "min_conflicts"]
    _check(rows, ref["max_steps"])


@pytest.mark.slow
@pytest.mark.skipif(not os.path.exists(FIX), reason="reference fixture not generated")
def test_matches_reference_full():
    ref = json.load(open(FIX))
    _check(ref["rows"], ref["max_steps"])


@pytest.mark.skipif(not os.path.exists(FIX), reason="reference fixture not generated")
def test_reference_digest_is_stable():
    import hashlib
    ref = json.load(open(FIX))
    rows = sorted(ref["rows"], key=lambda x: (x["set"], x["index"],
                                              x["algorithm"],
                                              -1 if x["seed"] is None else x["seed"]))
    canon = "\n".join(
        f"{x['set']}|{x['index']}|{x['algorithm']}|{x['seed']}|{int(x['solved'])}|"
        f"{x['solution']}|{x['nodes']}|{x['backtracks']}|{x['terminated_reason']}"
        for x in rows
    )
    assert hashlib.sha256(canon.encode()).hexdigest() == ref["sha256"]

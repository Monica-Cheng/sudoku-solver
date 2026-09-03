"""Dump unsampled Python event streams for a sample of puzzles, for the TS
event-stream parity test. Writes web/test/fixtures/event_streams.json.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
sys.path.insert(0, ROOT)
from solvers import solve  # noqa: E402


def read(path):
    d = "".join(c for c in open(path).read() if c.isdigit())
    return [d[i:i + 81] for i in range(0, len(d), 81) if i + 81 <= len(d)]


EASY = read(os.path.join(ROOT, "puzzles/easy.txt"))
MEDIUM = read(os.path.join(ROOT, "puzzles/medium.txt"))
HARD = read(os.path.join(ROOT, "puzzles/hard.txt"))

# (label, puzzle, max_steps) - chosen so every algorithm finishes with a
# bounded stream.
SAMPLES = [
    ("easy-2", EASY[2], 20000),
    ("easy-5", EASY[5], 20000),
    ("easy-11", EASY[11], 20000),
    ("medium-0", MEDIUM[0], 20000),
    ("medium-3", MEDIUM[3], 20000),
    ("hard-10", HARD[10], 20000),
    ("hard-16", HARD[16], 20000),
    ("hard-21", HARD[21], 40000),
]
ALGOS = ["backtracking", "forward_checking", "ac3", "min_conflicts"]

out = {}
for label, puz, ms in SAMPLES:
    for algo in ALGOS:
        evs = []
        r = solve(puz, algo, on_step=evs.append, seed=0, max_steps=ms)
        key = f"{algo}|{label}"
        out[key] = {
            "puzzle": puz,
            "seed": 0,
            "max_steps": ms,
            "result": {
                "solved": r.solved,
                "nodes": r.nodes,
                "backtracks": r.backtracks,
                "terminated_reason": r.terminated_reason,
            },
            "n_events": len(evs),
            "events": evs,
        }
        print(f"{key}: {len(evs)} events, nodes={r.nodes} reason={r.terminated_reason}", flush=True)

dest = os.path.join(ROOT, "web/test/fixtures")
os.makedirs(dest, exist_ok=True)
json.dump(out, open(os.path.join(dest, "event_streams.json"), "w"))
total = sum(v["n_events"] for v in out.values())
print(f"\n{len(out)} streams, {total} events total -> web/test/fixtures/event_streams.json")

"""Python solver benchmark (no tracemalloc - matches Phase 2 runtime_ms).
Prints median solve time (ms) per algorithm per tier; writes scratch/py_results.json.
"""
import json, os, sys, time, statistics as st

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
from solvers import solve, SOLVERS  # noqa: E402

TIERS = {
    "easy": f"{ROOT}/puzzles/easy.txt",
    "medium": f"{ROOT}/puzzles/medium.txt",
    "hard": f"{ROOT}/puzzles/hard.txt",
    "bench-hard": f"{ROOT}/benchmarks/hard.txt",
}
MAX_STEPS = 500_000
REPS = 5


def read(p):
    d = "".join(c for c in open(p).read() if c.isdigit())
    return [d[i:i + 81] for i in range(0, len(d), 81) if i + 81 <= len(d)]


results = {}
for algo in SOLVERS:
    results[algo] = {}
    for tier, path in TIERS.items():
        puzzles = read(path)
        for p in puzzles[:3]:
            solve(p, algo, seed=0, max_steps=MAX_STEPS)  # warm-up
        per_puzzle = []
        solved = 0
        for p in puzzles:
            times = []
            for i in range(REPS):
                t = time.perf_counter()
                r = solve(p, algo, seed=0, max_steps=MAX_STEPS)
                times.append((time.perf_counter() - t) * 1000)
                if i == 0 and r.solved:
                    solved += 1
            per_puzzle.append(st.median(times))
        m = st.median(per_puzzle)
        results[algo][tier] = {"medianMs": m, "solved": solved, "n": len(puzzles)}
        print(f"{algo:16} {tier:11} median {m:9.3f} ms   solved {solved}/{len(puzzles)}", flush=True)
    print()

json.dump({"maxSteps": MAX_STEPS, "reps": REPS, "results": results},
          open(f"{ROOT}/web/bench/py_results.json", "w"), indent=1)
print("-> scratch/py_results.json")

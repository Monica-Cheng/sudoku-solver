"""Full solver benchmark: solve rate, node counts, and timing per algorithm
per tier. No tracemalloc (it inflated Phase 2 timings 3.5-4.9x); no per-step
instrumentation (on_step=None) so timings measure the search, not the emitter.

    .venv/bin/python benchmarks/run_solver_bench.py

Writes benchmarks/results/solvers_python.json and prints a summary.
Deterministic solvers: one run per puzzle. min_conflicts: seeds 0,1,2.
"""
import json
import os
import statistics as st
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from solvers import SOLVERS, solve  # noqa: E402

TIERS = {
    "easy": f"{ROOT}/puzzles/easy.txt",
    "medium": f"{ROOT}/puzzles/medium.txt",
    "hard": f"{ROOT}/puzzles/hard.txt",
    "extreme": f"{ROOT}/benchmarks/hard.txt",
}
DETERMINISTIC = ("backtracking", "forward_checking", "ac3")
MAX_STEPS = 1_400_000          # cap for the deterministic solvers (page quotes this)
MC_MAX_STEPS = 200_000        # min_conflicts' own DEFAULT_MAX_STEPS — its natural budget
MC_SEEDS = (0, 1, 2)
REPS = 3                       # timing reps per puzzle; median kept


def read(path):
    d = "".join(c for c in open(path).read() if c.isdigit())
    return [d[i:i + 81] for i in range(0, len(d), 81) if i + 81 <= len(d)]


def bench_one(puzzle, algo, seed):
    """One puzzle: runtime plus the (deterministic) counts. Extra timing reps
    only for runs that finished fast — re-running a slow/capped solve just
    burns minutes for a number we already have to one significant figure."""
    cap = MC_MAX_STEPS if algo == "min_conflicts" else MAX_STEPS
    t0 = time.perf_counter()
    res = solve(puzzle, algo, seed=seed, max_steps=cap)
    first = (time.perf_counter() - t0) * 1000.0
    times = [first]
    if first < 40.0 and res.terminated_reason != "max_steps":
        for _ in range(REPS - 1):
            t0 = time.perf_counter()
            solve(puzzle, algo, seed=seed, max_steps=cap)
            times.append((time.perf_counter() - t0) * 1000.0)
    return {
        "solved": res.solved,
        "nodes": res.nodes,
        "backtracks": res.backtracks,
        "terminated_reason": res.terminated_reason,
        "ms": st.median(times),
    }


def main():
    out = {
        "max_steps": MAX_STEPS,
        "mc_max_steps": MC_MAX_STEPS,
        "mc_seeds": list(MC_SEEDS),
        "reps": REPS,
        "python": sys.version.split()[0],
        "tiers": {},
    }
    # warm-up (cheap tiers only; the extreme tier is timed cold)
    for algo in SOLVERS:
        for p in read(TIERS["easy"])[:3]:
            solve(p, algo, seed=0, max_steps=MAX_STEPS)

    for tier, path in TIERS.items():
        puzzles = read(path)
        out["tiers"][tier] = {"n": len(puzzles), "algos": {}}
        for algo in SOLVERS:
            runs = []
            seeds = MC_SEEDS if algo not in DETERMINISTIC else (None,)
            for idx, puz in enumerate(puzzles):
                for seed in seeds:
                    r = bench_one(puz, algo, seed)
                    r["index"] = idx
                    r["seed"] = seed
                    runs.append(r)
            solved = sum(r["solved"] for r in runs)
            node_list = sorted(r["nodes"] for r in runs)
            solved_nodes = sorted(r["nodes"] for r in runs if r["solved"])
            ms_list = sorted(r["ms"] for r in runs)
            reasons = {}
            for r in runs:
                reasons[r["terminated_reason"]] = reasons.get(r["terminated_reason"], 0) + 1
            out["tiers"][tier]["algos"][algo] = {
                "runs": len(runs),
                "solved": solved,
                "reasons": reasons,
                "nodes_all": node_list,
                "nodes_solved_median": st.median(solved_nodes) if solved_nodes else None,
                "nodes_solved_p90": _pct(solved_nodes, 90) if solved_nodes else None,
                "nodes_worst": node_list[-1],
                "ms_median": st.median(ms_list),
                "ms_p10": _pct(ms_list, 10),
                "ms_p90": _pct(ms_list, 90),
                "ms_worst": ms_list[-1],
                "per_run": runs,
            }
            m = out["tiers"][tier]["algos"][algo]
            print(f"{algo:16} {tier:8} solved {solved:3}/{len(runs):<3} "
                  f"median {m['ms_median']:9.3f} ms  median_nodes "
                  f"{m['nodes_solved_median']}  worst_nodes {m['nodes_worst']}  {reasons}",
                  flush=True)
        # dump after every tier so partial data is usable if the run is cut short
        os.makedirs(f"{ROOT}/benchmarks/results", exist_ok=True)
        json.dump(out, open(f"{ROOT}/benchmarks/results/solvers_python.json", "w"), indent=1)
        print(flush=True)

    print("-> benchmarks/results/solvers_python.json")


def _pct(sorted_xs, p):
    if not sorted_xs:
        return None
    k = (len(sorted_xs) - 1) * p / 100.0
    lo = int(k)
    hi = min(lo + 1, len(sorted_xs) - 1)
    return sorted_xs[lo] + (sorted_xs[hi] - sorted_xs[lo]) * (k - lo)


if __name__ == "__main__":
    main()

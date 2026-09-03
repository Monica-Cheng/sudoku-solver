"""Reference-output harness.

Runs the four solvers over one or more puzzle files and dumps
(solution, solved, nodes, backtracks, terminated_reason) per puzzle to JSON.
This file is the contract the TypeScript port is validated against in Phase 3.

    python -m harness.reference puzzles/easy.txt puzzles/medium.txt -o ref.json
    python -m harness.reference benchmarks/hard.txt --algorithms ac3,forward_checking \\
        --max-steps 200000 --seeds 0,1,2 -o ref_hard.json

min_conflicts is stochastic: pass --seeds to record one row per (puzzle, seed).
The deterministic solvers ignore seeds and record one row per puzzle.
"""
import argparse
import hashlib
import json
import os
import sys

from solvers import SOLVERS, solve

DETERMINISTIC = ("backtracking", "forward_checking", "ac3")


def read_puzzles(path):
    d = "".join(c for c in open(path).read() if c.isdigit())
    return [d[i:i + 81] for i in range(0, len(d), 81) if i + 81 <= len(d)]


def main(argv=None):
    ap = argparse.ArgumentParser(prog="harness.reference")
    ap.add_argument("files", nargs="+")
    ap.add_argument("-o", "--out", default="reference.json")
    ap.add_argument("--algorithms", default=",".join(SOLVERS),
                    help="comma-separated subset of " + ",".join(SOLVERS))
    ap.add_argument("--seeds", default="0",
                    help="comma-separated seeds for min_conflicts")
    ap.add_argument("--max-steps", type=int, default=None)
    args = ap.parse_args(argv)

    algos = [a.strip() for a in args.algorithms.split(",") if a.strip()]
    seeds = [int(s) for s in args.seeds.split(",") if s.strip() != ""]
    bad = [a for a in algos if a not in SOLVERS]
    if bad:
        ap.error(f"unknown algorithms: {bad}")

    rows = []
    for path in args.files:
        # parent/stem so puzzles/hard.txt and benchmarks/hard.txt don't collide
        stem = os.path.splitext(os.path.basename(path))[0]
        parent = os.path.basename(os.path.dirname(os.path.abspath(path)))
        setname = f"{parent}/{stem}"
        puzzles = read_puzzles(path)
        for idx, puz in enumerate(puzzles):
            for algo in algos:
                run_seeds = seeds if algo not in DETERMINISTIC else [None]
                for seed in run_seeds:
                    r = solve(puz, algo, seed=seed, max_steps=args.max_steps)
                    rows.append({
                        "set": setname, "index": idx, "puzzle": puz,
                        "algorithm": algo, "seed": r.seed,
                        "solution": r.solution, "solved": r.solved,
                        "nodes": r.nodes, "backtracks": r.backtracks,
                        "terminated_reason": r.terminated_reason,
                    })
                    print(f"  {setname:11} #{idx:2d} {algo:16} "
                          f"seed={r.seed} solved={r.solved} "
                          f"nodes={r.nodes} bt={r.backtracks}", flush=True)

    rows.sort(key=lambda x: (x["set"], x["index"], x["algorithm"],
                             -1 if x["seed"] is None else x["seed"]))
    canon = "\n".join(
        f"{x['set']}|{x['index']}|{x['algorithm']}|{x['seed']}|"
        f"{int(x['solved'])}|{x['solution']}|{x['nodes']}|{x['backtracks']}|"
        f"{x['terminated_reason']}"
        for x in rows
    )
    digest = hashlib.sha256(canon.encode()).hexdigest()
    payload = {
        "sha256": digest,
        "max_steps": args.max_steps,
        "algorithms": algos,
        "seeds": seeds,
        "n_rows": len(rows),
        "rows": rows,
    }
    with open(args.out, "w") as fh:
        json.dump(payload, fh, indent=1)
    print(f"\n{len(rows)} rows -> {args.out}")
    print(f"SHA256 = {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

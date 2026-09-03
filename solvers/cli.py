"""Command-line front end for the solver package.

    python -m solvers.cli <algorithm> <puzzle-file> [<puzzle-file> ...]

    python -m solvers.cli ac3 puzzles/easy.txt puzzles/medium.txt
    python -m solvers.cli backtracking benchmarks/hard.txt --timeout 30
    python -m solvers.cli min_conflicts puzzles/hard.txt --repeats 5 --seed 0 --csv out.csv

This module owns every "CLI concern" that used to live in the Algo*/*_run.py
scripts - tabulate tables, CSV files, per-puzzle wall-clock timeouts. None of
it is importable from ``solvers`` itself; ``import solvers`` pulls in no
tabulate / csv / argparse.
"""
import argparse
import csv
import os
import signal
import sys

from . import SOLVERS, solve

try:
    from tabulate import tabulate
except ImportError:  # pragma: no cover - tabulate is optional for the CLI
    def tabulate(rows, headers=(), tablefmt=""):
        out = [" | ".join(map(str, headers))] if headers else []
        out += [" | ".join(map(str, r)) for r in rows]
        return "\n".join(out)


class _Timeout(BaseException):
    pass


def _read_puzzles(path):
    digits = "".join(c for c in open(path).read() if c.isdigit())
    return [digits[i:i + 81] for i in range(0, len(digits), 81) if i + 81 <= len(digits)]


def _run_with_timeout(seconds, fn):
    if not seconds:
        return fn()

    def _handler(sig, frame):
        raise _Timeout()

    old = signal.signal(signal.SIGALRM, _handler)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        return fn()
    except _Timeout:
        return None
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="solvers.cli")
    ap.add_argument("algorithm", choices=sorted(SOLVERS))
    ap.add_argument("files", nargs="+", help="puzzle files (81 digits per line)")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--repeats", type=int, default=1,
                    help="runs per puzzle (min_conflicts); seed increments per run")
    ap.add_argument("--max-steps", type=int, default=None)
    ap.add_argument("--timeout", type=float, default=None,
                    help="per-puzzle wall-clock cap in seconds")
    ap.add_argument("--csv", default=None, help="write per-run rows to this CSV")
    args = ap.parse_args(argv)

    rows = []
    for path in args.files:
        name = os.path.basename(path)
        puzzles = _read_puzzles(path)
        for i, puz in enumerate(puzzles, 1):
            for rep in range(args.repeats):
                seed = None if args.seed is None else args.seed + rep
                res = _run_with_timeout(
                    args.timeout,
                    lambda: solve(puz, args.algorithm, seed=seed,
                                  max_steps=args.max_steps),
                )
                if res is None:
                    rows.append([name, i, rep, "TIMEOUT", "", "", "", ""])
                else:
                    rows.append([name, i, rep,
                                 "solved" if res.solved else res.terminated_reason,
                                 f"{res.runtime_ms:.2f}", res.nodes, res.backtracks,
                                 res.seed if res.seed is not None else ""])

    headers = ["file", "puzzle", "rep", "status", "ms", "nodes", "backtracks", "seed"]
    print(f"\nalgorithm: {args.algorithm}\n")
    print(tabulate(rows, headers=headers, tablefmt="github"))

    solved = sum(1 for r in rows if r[3] == "solved")
    print(f"\nsolved {solved}/{len(rows)}")

    by_file = {}
    for r in rows:
        d = by_file.setdefault(r[0], {"n": 0, "ok": 0, "nodes": 0, "bt": 0})
        d["n"] += 1
        if r[3] == "solved":
            d["ok"] += 1
            d["nodes"] += int(r[5])
            d["bt"] += int(r[6])
    stat_rows = [[f, d["ok"], d["n"],
                  d["nodes"] // d["ok"] if d["ok"] else 0,
                  d["bt"] // d["ok"] if d["ok"] else 0]
                 for f, d in by_file.items()]
    print("\n" + tabulate(stat_rows,
                          headers=["file", "solved", "total", "avg nodes", "avg bt"],
                          tablefmt="github"))

    if args.csv:
        with open(args.csv, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(headers)
            w.writerows(rows)
        print(f"\nwrote {args.csv}")

    return 0 if solved == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())

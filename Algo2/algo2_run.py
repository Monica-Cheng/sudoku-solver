import sys
import os
import io
import time
import csv
import tracemalloc
from tabulate import tabulate
from typing import List, Dict

# Algorithm 2: Backtracking + Forward Checking + MRV
# The search itself lives in solver.py / SudokuBoard.py (adapted from
# https://github.com/paccionesawyer/sudokuSolver-CSP). This runner only wraps a
# single puzzle string into a SudokuBoard and collects metrics.
from SudokuBoard import SudokuBoard
from solver import forward_checking, minimum_remaining_values

DIGITS = set("123456789")


# Single puzzle solver
def solve_single_puzzle(puzzle_string: str, show_output=True):
    if len(puzzle_string) != 81:
        raise ValueError(
            f"Puzzle must be exactly 81 characters, got {len(puzzle_string)}"
        )

    # Adapt the 81-char string into the file-like object SudokuBoard expects.
    board = SudokuBoard(io.StringIO(puzzle_string))

    if show_output:
        print("ORIGINAL PUZZLE:")
        print_puzzle(puzzle_string)

    tracemalloc.start()
    start = time.perf_counter()

    success = False
    try:
        forward_checking(board, minimum_remaining_values)
        success = _is_solved(board.board)
    except Exception as e:
        print(f" ERROR: {e}")
        success = False

    end = time.perf_counter()
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    runtime = end - start
    memory_mb = peak / (1024 * 1024)

    # forward_checking counts search nodes in unique_states and dead ends in
    # backtracks on the board object.
    nodes = getattr(board, "unique_states", 0)
    backtracks = getattr(board, "backtracks", 0)

    solved_string = "".join(
        str(board.board[r][c]) for r in range(9) for c in range(9)
    )
    if show_output and success:
        print("SOLVED PUZZLE:")
        print_puzzle(solved_string)

    return (
        solved_string if success else None,
        runtime,
        memory_mb,
        nodes,
        backtracks,
        success,
    )


def _is_solved(grid: List[List[int]]) -> bool:
    """True if grid is a completely filled, valid Sudoku."""
    for i in range(9):
        row = [grid[i][j] for j in range(9)]
        col = [grid[j][i] for j in range(9)]
        if set(map(str, row)) != DIGITS or set(map(str, col)) != DIGITS:
            return False
    for br in range(0, 9, 3):
        for bc in range(0, 9, 3):
            box = [grid[br + i][bc + j] for i in range(3) for j in range(3)]
            if set(map(str, box)) != DIGITS:
                return False
    return True


# Print Sudoku
def print_puzzle(puzzle_string: str):
    print()
    for r in range(9):
        row = [
            puzzle_string[r * 9 + c] if puzzle_string[r * 9 + c] != "0" else "."
            for c in range(9)
        ]
        print(
            " ".join(row[0:3]) + " | "
            + " ".join(row[3:6]) + " | "
            + " ".join(row[6:9])
        )
        if r in [2, 5]:
            print("-" * 21)
    print()


# CSV + batch solving
def read_puzzles_from_file(filename):
    puzzles = []
    if not os.path.isfile(filename):
        print(f" File not found: {filename}")
        return puzzles
    with open(filename, "r", encoding="utf-8") as f:
        digits = "".join(ch for ch in f.read() if ch.isdigit())
        for i in range(0, len(digits), 81):
            if i + 81 <= len(digits):
                puzzles.append(digits[i:i+81])
    return puzzles


def log_to_csv(row: Dict, csv_filename="performance_log_fc_mrv.csv"):
    file_exists = os.path.isfile(csv_filename)
    with open(csv_filename, "a", newline="", encoding="utf-8") as f:
        fieldnames = [
            "File", "PuzzleIndex", "GlobalIndex", "Runtime(s)",
            "Memory(MB)", "NodesVisited", "Backtracks", "Success"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)
        f.flush()


def solve_all_puzzles(filenames: List[str]):
    print(f"\n{'='*70}")
    print("SUDOKU SOLVER - Backtracking + Forward Checking + MRV")
    print(f"{'='*70}\n")

    log_file = "performance_log_fc_mrv.csv"
    if os.path.exists(log_file):
        os.remove(log_file)
        print(f"Cleared existing {log_file}\n")

    all_results = []
    global_index = 0

    for filename in filenames:
        puzzles = read_puzzles_from_file(filename)
        if not puzzles:
            continue
        print(f"\nFile: {filename} | {len(puzzles)} puzzles found")

        for idx, puzzle in enumerate(puzzles, 1):
            global_index += 1
            print(f"\n{'='*70}")
            print(f"File: {filename} | Puzzle #{idx} | Global #{global_index}")
            print(f"{'='*70}")
            solved, runtime, mem, nodes, backs, success = solve_single_puzzle(
                puzzle, show_output=True
            )

            row = {
                "File": os.path.basename(filename),
                "PuzzleIndex": idx,
                "GlobalIndex": global_index,
                "Runtime(s)": f"{runtime:.6f}",
                "Memory(MB)": f"{mem:.6f}",
                "NodesVisited": nodes,
                "Backtracks": backs,
                "Success": success,
            }
            log_to_csv(row, log_file)
            all_results.append(row)

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY REPORT")
    print(f"{'='*70}\n")

    if not all_results:
        print("No puzzles processed.")
        return

    table = []
    for r in all_results:
        status = "✓" if r["Success"] else "✗"
        table.append([
            r["GlobalIndex"], r["File"], r["PuzzleIndex"], r["Runtime(s)"],
            r["Memory(MB)"], r["NodesVisited"], r["Backtracks"], status
        ])
    print(tabulate(
        table,
        headers=[
            "Global#", "File", "Puzzle#", "Runtime(s)", "Memory(MB)",
            "Nodes", "Backtracks", "Status"
        ],
        tablefmt="grid"
    ))

    # Statistics by difficulty
    print(f"\n{'='*70}")
    print("STATISTICS BY DIFFICULTY (with Accuracy)")
    print(f"{'='*70}\n")

    files = {}
    for r in all_results:
        fname = r["File"]
        if fname not in files:
            files[fname] = {
                "solved": 0, "total": 0,
                "runtime": 0.0, "nodes": 0, "backs": 0
            }
        files[fname]["total"] += 1
        if r["Success"]:
            files[fname]["solved"] += 1
            files[fname]["runtime"] += float(r["Runtime(s)"])
            files[fname]["nodes"] += int(r["NodesVisited"])
            files[fname]["backs"] += int(r["Backtracks"])

    stats = []
    for fname, s in files.items():
        acc = (s["solved"] / s["total"] * 100) if s["total"] > 0 else 0
        avg_runtime = s["runtime"] / s["solved"] if s["solved"] > 0 else 0
        avg_nodes = s["nodes"] / s["solved"] if s["solved"] > 0 else 0
        avg_back = s["backs"] / s["solved"] if s["solved"] > 0 else 0
        stats.append([
            fname, f"{s['solved']}/{s['total']}", f"{acc:.1f}%",
            f"{avg_runtime:.6f}", f"{avg_nodes:.0f}", f"{avg_back:.0f}"
        ])

    print(tabulate(
        stats,
        headers=["File", "Solved", "Accuracy",
                 "Avg Runtime(s)", "Avg Nodes", "Avg Backtracks"],
        tablefmt="grid"
    ))

    # Overall stats
    print(f"\n{'='*70}")
    print("OVERALL STATISTICS")
    print(f"{'='*70}\n")

    total = len(all_results)
    solved = sum(1 for r in all_results if r["Success"])
    acc = (solved / total * 100) if total else 0
    overall = [
        ["Total Puzzles", total],
        ["Solved", solved],
        ["Failed", total - solved],
        ["Overall Accuracy", f"{acc:.2f}%"],
    ]
    print(tabulate(overall, tablefmt="simple"))
    print(f"\n{'='*70}")
    print(f"Results saved to: {log_file}")
    print(f"Algorithm: Backtracking + Forward Checking + MRV")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python algo2_run.py easy.txt medium.txt hard.txt")
        sys.exit(1)

    solve_all_puzzles(sys.argv[1:])

"""Algo4 - min-conflicts local search.

Ported unchanged (search-behaviour-wise) from Algo4/algo4_run.py:
 - each row is seeded with a random permutation completing its missing digits;
 - each iteration: pick a random conflicted non-fixed cell, try swapping it
   with every other non-fixed cell in its row, take the swap that minimises
   total conflicts; if no swap helps, reset the cell to a random min-conflict
   value (counted as a backtrack);
 - one node per iteration; stops when no cell is conflicted or after max_steps.

Change from the original: the module-level `random` is replaced by a
`random.Random(seed)` instance threaded through random_initial_board and the
iteration loop, so a given seed reproduces a run exactly and two solves never
share RNG state. `random.Random(seed).shuffle/.choice` produce the same
sequence as `random.seed(seed); random.shuffle/.choice`, so seeded runs match
the Phase 1 baseline.
"""
import random as _random

from ..events import CONFLICTS, REASSIGN, SOLVED, START, STOPPED, SWAP

ALGORITHM_NAME = "min_conflicts"
DEFAULT_MAX_STEPS = 200_000
N = 9


def get_conflicts(board, row, col, val):
    conflicts = 0
    for k in range(N):
        if k != col and board[row][k] == val:
            conflicts += 1
    for k in range(N):
        if k != row and board[k][col] == val:
            conflicts += 1
    start_row, start_col = 3 * (row // 3), 3 * (col // 3)
    for r in range(start_row, start_row + 3):
        for c in range(start_col, start_col + 3):
            if (r != row or c != col) and board[r][c] == val:
                conflicts += 1
    return conflicts


def random_initial_board(puzzle, rng):
    board = [row[:] for row in puzzle]
    for i in range(N):
        present = [x for x in board[i] if x != 0]
        missing = [n for n in range(1, 10) if n not in present]
        rng.shuffle(missing)
        midx = 0
        for j in range(N):
            if board[i][j] == 0:
                board[i][j] = missing[midx]
                midx += 1
    return board


def conflicted_cells(board, fixed):
    cells = []
    for i in range(N):
        for j in range(N):
            if not fixed[i][j] and get_conflicts(board, i, j, board[i][j]) > 0:
                cells.append((i, j))
    return cells


def total_conflicts_for_swap(board, r1, c1, r2, c2):
    v1, v2 = board[r1][c1], board[r2][c2]
    return get_conflicts(board, r1, c1, v2) + get_conflicts(board, r2, c2, v1)


def _parse(puzzle: str):
    return [list(map(int, puzzle[i:i + 9])) for i in range(0, 81, 9)]


def search(puzzle: str, sampler=None, max_steps=None, seed=None):
    if max_steps is None:
        max_steps = DEFAULT_MAX_STEPS
    if seed is None:
        seed = _random.randrange(2**32)
    rng = _random.Random(seed)
    emit = sampler.emit if sampler is not None else None

    grid = _parse(puzzle)
    fixed = [[grid[i][j] != 0 for j in range(N)] for i in range(N)]
    if sampler is not None:
        sampler.emit(START, algorithm=ALGORITHM_NAME, givens=puzzle)
    board = random_initial_board(grid, rng)

    nodes = 0
    backtracks = 0
    reason = "max_steps"

    for step in range(max_steps):
        nodes += 1
        if sampler is not None:
            sampler.tick()

        conflicted = conflicted_cells(board, fixed)
        if emit:
            emit(CONFLICTS, count=len(conflicted), iteration=step)
        if not conflicted:
            reason = "solved"
            break

        row, col = rng.choice(conflicted)

        best_swap, best_conf = None, None
        for j in range(N):
            if j == col or fixed[row][j]:
                continue
            conf = total_conflicts_for_swap(board, row, col, row, j)
            if best_conf is None or conf < best_conf:
                best_conf, best_swap = conf, j

        if best_swap is not None:
            va, vb = board[row][col], board[row][best_swap]
            board[row][col], board[row][best_swap] = vb, va
            if emit:
                emit(SWAP, cell_a=row * 9 + col, cell_b=row * 9 + best_swap,
                     value_a=va, value_b=vb)
        else:
            backtracks += 1
            min_conf = float("inf")
            best_vals = []
            for val in range(1, 10):
                c = get_conflicts(board, row, col, val)
                if c < min_conf:
                    min_conf = c
                    best_vals = [val]
                elif c == min_conf:
                    best_vals.append(val)
            prev = board[row][col]
            board[row][col] = rng.choice(best_vals)
            if emit:
                emit(REASSIGN, cell=row * 9 + col, value=board[row][col], previous=prev)

    solution = "".join(str(x) for r in board for x in r) if reason == "solved" else None
    if sampler is not None:
        if reason == "solved":
            sampler.emit(SOLVED, solution=solution)
        else:
            sampler.emit(STOPPED, reason=reason)
    return solution, reason == "solved", nodes, backtracks, reason, seed

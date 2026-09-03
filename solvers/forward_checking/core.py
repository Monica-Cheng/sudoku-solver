"""Algo2 - backtracking + forward checking + MRV.

Ported unchanged (search-behaviour-wise) from Algo2/solver.py:
 - domains[i][j] is a list; givens are set to [-1] and their value pruned from
   the row/column/box domains of the blank cells;
 - the next cell is the blank with the fewest remaining domain values (MRV;
   ties -> earliest in row-major order);
 - values are tried in current domain-list order (which drifts as entries are
   removed/re-appended on backtrack), guarded by SudokuBoard.valid_input;
 - after each placement every domain is re-checked for emptiness (forward
   check); a dead end restores the domain (repair_domains) and counts one
   backtrack;
 - one node per cell visited (unique_states), one backtrack per failed value.

The domain lists and the SudokuBoard are per-solve, so concurrent solves are
independent. The only additions are optional emit/sampler hooks and a
max_steps cap on unique_states.
"""
from ..events import ASSIGN, ELIMINATE, RESTORE, START, SOLVED, STOPPED, UNASSIGN
from .board import SudokuBoard

ALGORITHM_NAME = "forward_checking"


class _Budget(BaseException):
    pass


# --------------------------------------------------------------------------- #
#  Domain setup / maintenance (unchanged; emit/by are optional)
# --------------------------------------------------------------------------- #
def set_domains(board):
    n = 9
    domains = [[[1, 2, 3, 4, 5, 6, 7, 8, 9] for _ in range(n)] for _ in range(n)]
    for i in range(n):
        for j in range(n):
            val = board.board[i][j]
            if val != 0:
                domains[i][j] = [-1]
                constrict_domains(board, i, j, val, domains)
    return domains


def constrict_domains(board, row, col, num, domains, emit=None, by=None):
    constrict_box_domains(board, row, col, num, domains, emit, by)
    constrict_row_domains(board, row, col, num, domains, emit, by)
    constrict_col_domains(board, row, col, num, domains, emit, by)


def constrict_box_domains(board, row, col, num, domains, emit=None, by=None):
    box_x, box_y = col // 3, row // 3
    for i in range(box_y * 3, box_y * 3 + 3):
        for j in range(box_x * 3, box_x * 3 + 3):
            if num in domains[i][j] and board.board[i][j] == 0:
                domains[i][j].remove(num)
                if emit:
                    emit(ELIMINATE, cell=i * 9 + j, value=num, by=by)


def constrict_row_domains(board, row, col, num, domains, emit=None, by=None):
    for j in range(9):
        if num in domains[row][j] and board.board[row][j] == 0:
            domains[row][j].remove(num)
            if emit:
                emit(ELIMINATE, cell=row * 9 + j, value=num, by=by)


def constrict_col_domains(board, row, col, num, domains, emit=None, by=None):
    for i in range(9):
        if num in domains[i][col] and board.board[i][col] == 0:
            domains[i][col].remove(num)
            if emit:
                emit(ELIMINATE, cell=i * 9 + col, value=num, by=by)


def repair_domains(board, row, col, num, domains, emit=None):
    box_x, box_y = col // 3, row // 3
    for i in range(box_y * 3, box_y * 3 + 3):
        for j in range(box_x * 3, box_x * 3 + 3):
            if board.valid_input(i, j, num) and num not in domains[i][j]:
                domains[i][j].append(num)
                if emit:
                    emit(RESTORE, cell=i * 9 + j, value=num, by=None)
    for j in range(9):
        if board.valid_input(row, j, num) and num not in domains[row][j]:
            domains[row][j].append(num)
            if emit:
                emit(RESTORE, cell=row * 9 + j, value=num, by=None)
    for i in range(9):
        if board.valid_input(i, col, num) and num not in domains[i][col]:
            domains[i][col].append(num)
            if emit:
                emit(RESTORE, cell=i * 9 + col, value=num, by=None)


def empty_domain(board, domains):
    for i in range(9):
        for j in range(9):
            if board.board[i][j] == 0 and len(domains[i][j]) == 0:
                return True
    return False


def minimum_remaining_values(board, domains):
    mrv = None
    min_len = 10
    for i in range(9):
        for j in range(9):
            if board.board[i][j] == 0 and len(domains[i][j]) < min_len:
                mrv = [i, j]
                min_len = len(domains[i][j])
    return mrv


# --------------------------------------------------------------------------- #
#  Search
# --------------------------------------------------------------------------- #
class _Runner:
    def __init__(self, board, sampler, max_steps):
        self.board = board
        self.sampler = sampler
        self.emit = sampler.emit if sampler is not None else None
        self._cap = max_steps
        self._budgeted = max_steps is not None

    def rec(self, heuristic, domains, depth=0):
        nxt = heuristic(self.board, domains)
        if not nxt:
            return True
        row, col = nxt
        self.board.unique_states += 1
        if self._budgeted and self.board.unique_states > self._cap:
            self.board.unique_states -= 1
            raise _Budget
        if self.sampler is not None:
            self.sampler.tick()
        cidx = row * 9 + col

        for val in list(domains[row][col]):
            if self.board.valid_input(row, col, val):
                self.board.board[row][col] = val
                if self.emit:
                    self.emit(ASSIGN, cell=cidx, value=val, depth=depth)
                constrict_domains(self.board, row, col, val, domains,
                                  emit=self.emit, by=cidx)

                if not empty_domain(self.board, domains):
                    if self.rec(heuristic, domains, depth + 1):
                        return True

                self.board.board[row][col] = 0
                if self.emit:
                    self.emit(UNASSIGN, cell=cidx, value=val, depth=depth)
                self.board.backtracks += 1
                repair_domains(self.board, row, col, val, domains, emit=self.emit)
        return False


def search(puzzle: str, sampler=None, max_steps=None):
    board = SudokuBoard.from_string(puzzle)
    board.unique_states = 0
    if sampler is not None:
        sampler.emit(START, algorithm=ALGORITHM_NAME, givens=puzzle)
    domains = set_domains(board)
    runner = _Runner(board, sampler, max_steps)
    reason = "exhausted"
    try:
        if runner.rec(minimum_remaining_values, domains):
            reason = "solved"
    except _Budget:
        reason = "max_steps"
    solution = ("".join(str(board.board[r][c]) for r in range(9) for c in range(9))
                if reason == "solved" else None)
    if sampler is not None:
        if reason == "solved":
            sampler.emit(SOLVED, solution=solution)
        else:
            sampler.emit(STOPPED, reason=reason)
    return solution, reason == "solved", board.unique_states, board.backtracks, reason

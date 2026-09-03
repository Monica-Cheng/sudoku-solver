"""Algo3 - AC-3 constraint propagation, then backtracking (MRV + LCV + forward
checking) on whatever AC-3 leaves.

Ported unchanged (search-behaviour-wise) from Algo3/algo3_run.py:
 - build the CSP, run AC-3; if it wipes a domain -> no solution; if it leaves
   every domain a singleton -> solved with zero search;
 - otherwise seed the assignment with the singleton cells and run the tracked
   backtracking search;
 - one node per recursive call (including the terminal "assignment complete"
   call); one backtrack per failed value after unassign.

The CSP graph is cached on the Sudoku class (Phase 1), so back-to-back solves
share the read-only constraint tables and only rebuild per-puzzle domains.
Nothing mutable is shared, so concurrent solves are independent.
"""
from ..events import (ASSIGN, PHASE, SOLVED, START, STOPPED, UNASSIGN)
from .ac3 import AC3
from .heuristics import order_domain_values, select_unassigned_variable
from .sudoku import Sudoku
from .utils import assign, is_consistent, unassign

ALGORITHM_NAME = "ac3"
_ROW_LETTERS = "ABCDEFGHI"


def _idx(coord):
    return _ROW_LETTERS.index(coord[0]) * 9 + (int(coord[1]) - 1)


class _Budget(BaseException):
    pass


class _Backtracker:
    def __init__(self, sudoku, sampler, max_steps):
        self.sudoku = sudoku
        self.sampler = sampler
        self.emit = sampler.emit if sampler is not None else None
        self.nodes = 0
        self.backtracks = 0
        self._cap = max_steps
        self._budgeted = max_steps is not None

    def run(self, assignment, depth=0):
        self.nodes += 1
        if self._budgeted and self.nodes > self._cap:
            self.nodes -= 1
            raise _Budget
        if self.sampler is not None:
            self.sampler.tick()

        if len(assignment) == len(self.sudoku.cells):
            return assignment

        cell = select_unassigned_variable(assignment, self.sudoku)
        cidx = _idx(cell)
        for value in order_domain_values(self.sudoku, cell):
            if is_consistent(self.sudoku, assignment, cell, value):
                assign(self.sudoku, cell, value, assignment,
                       emit=self.emit, cidx=cidx)
                if self.emit:
                    self.emit(ASSIGN, cell=cidx, value=value, depth=depth)
                result = self.run(assignment, depth + 1)
                if result:
                    return result
                if self.emit:
                    self.emit(UNASSIGN, cell=cidx, value=value, depth=depth)
                unassign(self.sudoku, cell, assignment, emit=self.emit)
                self.backtracks += 1
        return False


def _to_string(sudoku):
    out = []
    for cell in sudoku.cells:
        poss = sudoku.possibilities[cell]
        out.append(str(poss[0]) if len(poss) == 1 else "0")
    return "".join(out)


def search(puzzle: str, sampler=None, max_steps=None):
    if sampler is not None:
        sampler.emit(START, algorithm=ALGORITHM_NAME, givens=puzzle)

    sudoku = Sudoku(puzzle)

    if sampler is not None:
        sampler.emit(PHASE, name="ac3")
    ok, revisions = AC3(sudoku, sampler=sampler)

    nodes = backtracks = 0
    reason = "exhausted"

    if not ok:
        reason = "no_solution"
    elif sudoku.isFinished():
        reason = "solved"
    else:
        if sampler is not None:
            sampler.emit(PHASE, name="backtracking")
        assignment = {c: sudoku.possibilities[c][0]
                      for c in sudoku.cells if len(sudoku.possibilities[c]) == 1}
        bt = _Backtracker(sudoku, sampler, max_steps)
        try:
            result = bt.run(assignment)
        except _Budget:
            result = False
            reason = "max_steps"
        nodes, backtracks = bt.nodes, bt.backtracks
        if result:
            for c in sudoku.possibilities:
                if c in result:
                    sudoku.possibilities[c] = [result[c]]
            reason = "solved"
        elif reason != "max_steps":
            reason = "exhausted"

    solution = _to_string(sudoku) if reason == "solved" else None
    if sampler is not None:
        if reason == "solved":
            sampler.emit(SOLVED, solution=solution)
        else:
            sampler.emit(STOPPED, reason=reason)
    extra = {"ac3_revisions": revisions, "ac3_alone": (nodes == 0 and reason == "solved")}
    return solution, reason == "solved", nodes, backtracks, reason, extra

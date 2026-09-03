"""Algo1 - plain recursive backtracking with peer-based candidate filtering.

Ported unchanged (search-behaviour-wise) from Algo1/algo1_run.py:
 - cells are visited in fixed order A1..I9 (row-major); the first blank is
   filled next;
 - candidates for a cell are the digits 1..9 not already used by its 20 peers,
   tried in ascending order;
 - one node is counted per digit tried; one backtrack per dead end (no
   candidates) and one per cell whose candidates are all exhausted;
 - goal test is a full validity scan of every line and box.

The only structural change is that the working grid (`values`) and the
counters are instance state instead of module globals, so concurrent solves
don't collide. The peer/line/box tables are puzzle-independent and built once.
"""
from ..events import ASSIGN, UNASSIGN, START, SOLVED, STOPPED

_ROWS = "ABCDEFGHI"
_COLS = "123456789"
_DIGITS = _COLS
_SQUARES = [r + c for r in _ROWS for c in _COLS]


def _build_tables():
    unitrows = []
    for r in range(3):
        for _ in range(3):
            unitrows.append([x + r * 3 for x in [1, 1, 1, 2, 2, 2, 3, 3, 3]])
    unitlist = [j for i in unitrows for j in i]

    units = {i: [] for i in range(1, 10)}
    for i, s in enumerate(_SQUARES):
        units[unitlist[i]].append(s)
    unit = {_SQUARES[i]: unitlist[i] for i in range(81)}

    lines = {}
    for row_or_col in _ROWS + _COLS:
        lines[row_or_col] = [s for s in _SQUARES if row_or_col in s]

    peers = {}
    for s in _SQUARES:
        pl = [units[unit[s]], lines[s[0]] + lines[s[1]]]
        peers[s] = set(p for p in [j for i in pl for j in i] if p != s)
    return units, lines, peers


_UNITS, _LINES, _PEERS = _build_tables()
_IDX = {s: i for i, s in enumerate(_SQUARES)}

ALGORITHM_NAME = "backtracking"


class _Budget(BaseException):
    pass


class _Search:
    def __init__(self, puzzle, sampler, max_steps):
        self.values = {_SQUARES[i]: puzzle[i] for i in range(81)}
        self.nodes = 0
        self.backtracks = 0
        self.sampler = sampler
        self._cap = max_steps
        self._budgeted = max_steps is not None
        self._emit = sampler.emit if sampler is not None else None

    def _valid(self):
        v = self.values
        if "0" in v.values():
            return False
        for members in _LINES.values():
            if set(v[s] for s in members) != set(_DIGITS):
                return False
        for members in _UNITS.values():
            if set(v[s] for s in members) != set(_DIGITS):
                return False
        return True

    def run(self, depth=0):
        if self._valid():
            return True

        current = None
        for s, val in self.values.items():
            if val == "0":
                current = s
                break

        peer_vals = [self.values[s] for s in _PEERS[current]]
        candidates = [d for d in _DIGITS if d not in peer_vals]
        if not candidates:
            self.backtracks += 1
            return False

        cidx = _IDX[current]
        for d in candidates:
            self.nodes += 1
            if self._budgeted and self.nodes > self._cap:
                self.nodes -= 1
                raise _Budget
            if self.sampler is not None:
                self.sampler.tick()
                if self._emit:
                    self._emit(ASSIGN, cell=cidx, value=int(d), depth=depth)
            self.values[current] = d
            if self.run(depth + 1):
                return True
        if self._emit:
            self._emit(UNASSIGN, cell=cidx, value=int(self.values[current]), depth=depth)
        self.values[current] = "0"
        self.backtracks += 1
        return False


def search(puzzle: str, sampler=None, max_steps=None):
    """Returns (solution_or_None, solved, nodes, backtracks, terminated_reason)."""
    s = _Search(puzzle, sampler, max_steps)
    if sampler is not None:
        sampler.emit(START, algorithm=ALGORITHM_NAME, givens=puzzle)
    reason = "exhausted"
    try:
        if s.run():
            reason = "solved"
    except _Budget:
        reason = "max_steps"
    solution = "".join(s.values[sq] for sq in _SQUARES) if reason == "solved" else None
    if sampler is not None:
        if reason == "solved":
            sampler.emit(SOLVED, solution=solution)
        else:
            sampler.emit(STOPPED, reason=reason)
    return solution, reason == "solved", s.nodes, s.backtracks, reason

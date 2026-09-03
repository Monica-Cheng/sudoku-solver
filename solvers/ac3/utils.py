"""CSP helpers for Algo3 - unchanged from Algo3/utils.py except:
 - the CLI-only fetch_sudokus / print_grid helpers are dropped;
 - forward_check takes an optional emit hook (does not affect its logic).
"""
from ..events import ELIMINATE, RESTORE


def is_different(cell_i, cell_j):
    return cell_i != cell_j


def number_of_conflicts(sudoku, cell, value):
    count = 0
    for related_c in sudoku.related_cells[cell]:
        if len(sudoku.possibilities[related_c]) > 1 and value in sudoku.possibilities[related_c]:
            count += 1
    return count


def is_consistent(sudoku, assignment, cell, value):
    is_consistent = True
    for current_cell, current_value in assignment.items():
        if current_value == value and current_cell in sudoku.related_cells[cell]:
            is_consistent = False
    return is_consistent


def assign(sudoku, cell, value, assignment, emit=None, cidx=None):
    assignment[cell] = value
    if sudoku.possibilities:
        forward_check(sudoku, cell, value, assignment, emit=emit, cidx=cidx)


def unassign(sudoku, cell, assignment, emit=None):
    if cell in assignment:
        for (coord, value) in sudoku.pruned[cell]:
            sudoku.possibilities[coord].append(value)
            if emit:
                emit(RESTORE, cell=_coord_idx(coord), value=value, by=None)
        sudoku.pruned[cell] = []
        del assignment[cell]


def forward_check(sudoku, cell, value, assignment, emit=None, cidx=None):
    for related_c in sudoku.related_cells[cell]:
        if related_c not in assignment:
            if value in sudoku.possibilities[related_c]:
                sudoku.possibilities[related_c].remove(value)
                sudoku.pruned[cell].append((related_c, value))
                if emit:
                    emit(ELIMINATE, cell=_coord_idx(related_c), value=value, by=cidx)


_ROW_LETTERS = "ABCDEFGHI"


def _coord_idx(coord):
    return _ROW_LETTERS.index(coord[0]) * 9 + (int(coord[1]) - 1)

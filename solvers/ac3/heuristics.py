"""Variable / value ordering for Algo3 - unchanged from Algo3/heuristics.py."""
from .utils import number_of_conflicts


def select_unassigned_variable(assignment, sudoku):
    """MRV: the unassigned cell with the fewest remaining possibilities."""
    unassigned = []
    for cell in sudoku.cells:
        if cell not in assignment:
            unassigned.append(cell)
    criterion = lambda cell: len(sudoku.possibilities[cell])
    return min(unassigned, key=criterion)


def order_domain_values(sudoku, cell):
    """LCV: values that rule out the fewest neighbour choices, first."""
    if len(sudoku.possibilities[cell]) == 1:
        return sudoku.possibilities[cell]
    criterion = lambda value: number_of_conflicts(sudoku, cell, value)
    return sorted(sudoku.possibilities[cell], key=criterion)

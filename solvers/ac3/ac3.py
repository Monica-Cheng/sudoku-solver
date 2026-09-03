"""AC-3 constraint propagation for Algo3.

Unchanged from Algo3/ac3.py except:
 - remove_inconsistent_values returns the list of removed values instead of a
   bool ([] is still falsy, so callers are unaffected);
 - AC3 takes an optional sampler so it can emit ac3_revise / eliminate events
   and tick the step counter on each worklist pop. None -> no events.
"""
from ..events import AC3_REVISE, ELIMINATE
from .utils import is_different

_ROW_LETTERS = "ABCDEFGHI"


def _idx(coord):
    return _ROW_LETTERS.index(coord[0]) * 9 + (int(coord[1]) - 1)


def AC3(csp, queue=None, sampler=None):
    if queue is None:
        queue = list(csp.binary_constraints)
    emit = sampler.emit if sampler is not None else None
    revisions = 0

    while queue:
        (xi, xj) = queue.pop(0)
        if sampler is not None:
            sampler.tick()
        removed = remove_inconsistent_values(csp, xi, xj, emit=emit)
        if removed:
            revisions += 1
            if emit:
                emit(AC3_REVISE, arc=[_idx(xi), _idx(xj)],
                     removed=list(removed), queue_size=len(queue))
            if len(csp.possibilities[xi]) == 0:
                return False, revisions
            for Xk in csp.related_cells[xi]:
                if Xk != xi:
                    queue.append((Xk, xi))
    return True, revisions


def remove_inconsistent_values(csp, cell_i, cell_j, emit=None):
    # NOTE: iterates csp.possibilities[cell_i] while removing from it, exactly
    # as the original Algo3/ac3.py does. This deliberately skips some elements
    # in one pass (they get another chance when the arc is re-queued). Changing
    # it to iterate a copy would alter the search - do not "fix" this.
    removed = []
    for value in csp.possibilities[cell_i]:
        if not any(is_different(value, poss) for poss in csp.possibilities[cell_j]):
            csp.possibilities[cell_i].remove(value)
            removed.append(value)
            if emit:
                emit(ELIMINATE, cell=_idx(cell_i), value=value, by=_idx(cell_j))
    return removed

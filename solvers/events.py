"""Step-event schema for animating the search.

An event is a plain ``dict`` (JSON-serialisable). Every event has:

    type : str        one of the constants below
    step : int        monotonic ordinal of the *primary tick* this event
                      belongs to (a search node for the backtracking solvers,
                      an iteration for min-conflicts, an arc revision for the
                      AC-3 phase). Multiple events can share a step.

Cells are always integers 0..80 (row-major); values are ints 1..9.

Universal events (every backtracking solver emits these):

    assign     {cell, value, depth}
        A value was placed in a cell during search.
    unassign   {cell, value, depth}
        Backtracking: the value was removed from the cell.
    eliminate  {cell, value, by}
        A candidate was pruned from a cell's domain. ``by`` is the cell whose
        assignment caused the pruning (or None).
    restore    {cell, value, by}
        A previously eliminated candidate was put back (on backtrack).

Algorithm-specific events:

    ac3_revise {arc: [cell_i, cell_j], removed: [values], queue_size}
        One arc revision in AC-3 constraint propagation (Algo3).
    swap       {cell_a, cell_b, value_a, value_b}
        Min-conflicts moved two values between cells in a row (Algo4).
    reassign   {cell, value, previous}
        Min-conflicts fallback: a cell was set to a new min-conflict value
        without a swap partner (Algo4).
    conflicts  {count, iteration}
        Current number of conflicted (non-fixed) cells (Algo4), emitted once
        per sampled iteration.

Lifecycle events (always delivered, never sampled out):

    start      {algorithm, givens: <81-char str>}
    phase      {name}                     e.g. "ac3", "backtracking" (Algo3)
    solved     {solution: <81-char str>}
    stopped    {reason}                    reason in TERMINATED_REASONS \ {"solved"}

Design notes
------------
* Cell as a single 0..80 int (not (r,c)) keeps events tiny and lines up with
  string indexing on the frontend.
* assign / unassign / eliminate / restore are a complete vocabulary for a
  *generic* renderer: fill a cell, clear a cell, dim a pencil mark, un-dim it.
  Algo1 emits only assign/unassign (it keeps no domains) -- that visibly makes
  it the "dumbest" solver. Algo2 adds eliminate/restore. Algo3 adds those plus
  ac3_revise. Algo4 speaks a different dialect (swap/reassign/conflicts)
  because it never assigns in the search sense.
* Every event is self-contained: a renderer never has to diff against previous
  state to draw the next frame.
* ``step`` is the true tick ordinal even when events are sampled, so the UI can
  show "step 412,000 of 1,400,000".
"""

# universal
ASSIGN = "assign"
UNASSIGN = "unassign"
ELIMINATE = "eliminate"
RESTORE = "restore"
# algorithm-specific
AC3_REVISE = "ac3_revise"
SWAP = "swap"
REASSIGN = "reassign"
CONFLICTS = "conflicts"
# lifecycle
START = "start"
PHASE = "phase"
SOLVED = "solved"
STOPPED = "stopped"

LIFECYCLE = frozenset({START, PHASE, SOLVED, STOPPED})

TERMINATED_REASONS = frozenset({
    "solved",        # a complete valid grid was found
    "exhausted",     # search space fully explored, no solution exists
    "no_solution",   # propagation proved inconsistency (invalid / contradictory givens)
    "max_steps",     # hit the max_steps work cap before finishing
})


def is_valid_event(ev: dict) -> bool:
    """Cheap structural check used by the test-suite: legal type, and every
    cell 0..80 / value 1..9."""
    if not isinstance(ev, dict) or "type" not in ev or "step" not in ev:
        return False
    t = ev["type"]
    if t in (ASSIGN, UNASSIGN):
        return _cell(ev.get("cell")) and _val(ev.get("value"))
    if t in (ELIMINATE, RESTORE):
        return _cell(ev.get("cell")) and _val(ev.get("value")) and _cell_or_none(ev.get("by"))
    if t == AC3_REVISE:
        arc = ev.get("arc")
        return (isinstance(arc, (list, tuple)) and len(arc) == 2
                and all(_cell(a) for a in arc)
                and all(_val(v) for v in ev.get("removed", [])))
    if t == SWAP:
        return (_cell(ev.get("cell_a")) and _cell(ev.get("cell_b"))
                and _val(ev.get("value_a")) and _val(ev.get("value_b")))
    if t == REASSIGN:
        return _cell(ev.get("cell")) and _val(ev.get("value"))
    if t == CONFLICTS:
        return isinstance(ev.get("count"), int) and ev["count"] >= 0
    if t in LIFECYCLE:
        return True
    return False


def _cell(x):
    return isinstance(x, int) and 0 <= x <= 80


def _cell_or_none(x):
    return x is None or _cell(x)


def _val(x):
    return isinstance(x, int) and 1 <= x <= 9

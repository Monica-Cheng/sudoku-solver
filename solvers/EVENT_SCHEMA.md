# Step-event schema

`solve(puzzle, algo, on_step=cb, ...)` calls `cb(event)` as the search runs.
Every `event` is a small JSON-serialisable `dict`. The schema is uniform
enough for a generic renderer, with per-algorithm extensions for the parts
that make each algorithm look different.

## Common fields

| field | type | meaning |
|---|---|---|
| `type` | str | one of the kinds below |
| `step` | int | ordinal of the **primary tick** this event belongs to — a search node (backtracking solvers), an iteration (min-conflicts), or an arc revision (AC-3 phase). Multiple events share a `step`. Survives sampling, so the UI can show "step 412 000 of 1 400 000". |

Cells are always integers **0–80**, row-major (`index = row*9 + col`) — the same
index as the position in the 81-char puzzle string. Values are ints **1–9**.

## Universal events — every backtracking solver emits these

| type | fields | when |
|---|---|---|
| `assign` | `cell, value, depth` | a value is placed in a cell during search |
| `unassign` | `cell, value, depth` | backtracking undoes that placement |
| `eliminate` | `cell, value, by` | a candidate is pruned from a cell's domain; `by` = the cell whose assignment caused it (or `null`) |
| `restore` | `cell, value, by` | a pruned candidate is put back (on backtrack) |

A generic renderer can animate **any** of the four solvers with just these:
fill a cell / clear a cell / dim a pencil-mark / un-dim it.

* `backtracking` (Algo1) emits only `assign` / `unassign` — it keeps no domains,
  which is precisely what makes it the "dumb" one to watch.
* `forward_checking` (Algo2) adds `eliminate` / `restore`.
* `ac3` (Algo3) adds those plus `ac3_revise` (below).

## Algorithm-specific events

| type | fields | algo | when |
|---|---|---|---|
| `ac3_revise` | `arc: [cell_i, cell_j]`, `removed: [values]`, `queue_size` | ac3 | one arc revision in AC-3 propagation removed at least one value |
| `swap` | `cell_a, cell_b, value_a, value_b` | min_conflicts | two values were exchanged between cells in a row |
| `reassign` | `cell, value, previous` | min_conflicts | fallback: a cell was set to a new min-conflict value with no swap partner |
| `conflicts` | `count, iteration` | min_conflicts | number of conflicted non-fixed cells, once per sampled iteration |

`min_conflicts` speaks a different dialect (`swap` / `reassign` / `conflicts`)
because it starts from a full grid and never "assigns" in the search sense.

## Lifecycle events — always delivered, never sampled out

| type | fields |
|---|---|
| `start` | `algorithm`, `givens` (81-char string) |
| `phase` | `name` — `"ac3"` or `"backtracking"` (Algo3 only) |
| `solved` | `solution` (81-char string) |
| `stopped` | `reason` — `terminated_reason` other than `"solved"` |

## Sampling

Pass `max_events` (needs `on_step`). The primary tick counter drives an even
stride `= ceil(work_budget / max_events)` where `work_budget` is `max_steps`
(or 1 000 000 if unset). A tick is *sampled* iff `tick % stride == 0`; all
sub-events of a sampled tick are forwarded so each frame is coherent.
Lifecycle events are exempt. A hard stop drops any further non-lifecycle
events once `max_events` have been delivered.

Delivered count is in `SolveResult.steps_emitted`.

## Design rationale

* **Single 0–80 int per cell** — tiny events, lines up with string indexing on
  the frontend; no `(r,c)` tuples.
* **Self-contained events** — a renderer never has to diff against previous
  state to draw the next frame.
* **Additive per-algo events** — a generic renderer ignores unknown `type`s; a
  specialised one can pulse the AC-3 arc or animate the swap.
* **`depth` on assign/unassign** — lets the UI draw recursion depth / a search
  tree.
* **`step` is the true tick ordinal, not the delivered index** — so a sampled
  stream still reports where in the search it is.

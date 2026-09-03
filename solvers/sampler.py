"""Step sampling / throttling for the on_step callback.

A search can emit millions of events (Algo1 hits ~1.4M nodes on the hardest
benchmark puzzles). ``StepSampler`` sits between the solver and the caller's
``on_step`` and forwards an evenly-spaced subset.

Contract
--------
* ``max_events is None``            -> forward every event.
* ``on_step is None``              -> the solver never builds an emitter and
                                     ``emit`` is a no-op reference (near-zero
                                     cost; see the overhead benchmark).
* otherwise the sampler forwards an event iff the *primary tick* it belongs to
  is on the stride, where::

      stride = max(1, ceil(work_budget / max_events))

  ``work_budget`` is ``max_steps`` when given, else ``DEFAULT_WORK_BUDGET``.
  Sub-events of a sampled tick (e.g. the eliminations triggered by one
  assignment) are all forwarded, so each delivered frame is coherent.
* Lifecycle events (start/phase/solved/stopped) are always forwarded and do
  not count against ``max_events``.
* A hard stop: once ``max_events`` non-lifecycle events have been delivered,
  further non-lifecycle events are dropped. With correct stride sizing this
  is rarely reached; it only bounds the eliminate-heavy tail.

The solver calls ``sampler.tick()`` once per primary step and
``sampler.emit(type, **fields)`` for every event.
"""
import math

from .events import LIFECYCLE

DEFAULT_WORK_BUDGET = 1_000_000


class StepSampler:
    __slots__ = ("_on_step", "_max_events", "_stride", "_tick", "_tick_live",
                 "_delivered", "_stopped")

    def __init__(self, on_step, max_events=None, max_steps=None):
        self._on_step = on_step
        self._max_events = max_events
        budget = max_steps if max_steps else DEFAULT_WORK_BUDGET
        if max_events is None or max_events <= 0:
            self._stride = 1
        else:
            self._stride = max(1, math.ceil(budget / max_events))
        self._tick = 0
        self._tick_live = True          # is the current tick on the stride?
        self._delivered = 0
        self._stopped = False

    # -- called once per primary step (node / iteration / arc revision) -------
    def tick(self):
        self._tick += 1
        self._tick_live = (self._tick % self._stride == 0)
        return self._tick

    @property
    def step(self):
        return self._tick

    @property
    def delivered(self):
        return self._delivered

    # -- called for every event --------------------------------------------
    def emit(self, ev_type, **fields):
        is_life = ev_type in LIFECYCLE
        if not is_life:
            if self._stopped or not self._tick_live:
                return
            if self._max_events is not None and self._delivered >= self._max_events:
                self._stopped = True
                return
        ev = {"type": ev_type, "step": self._tick, **fields}
        if not is_life:
            self._delivered += 1
        self._on_step(ev)

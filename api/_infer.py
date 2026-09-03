"""Digit recognition: image bytes -> recognized 9x9 grid + per-cell confidence.

Dependencies: numpy, onnxruntime, opencv-python-headless (via _pipeline).
The ONNX session is created once at import time (module scope).

    result = recognize(image_bytes)
    # {"grid": str(81), "confidences": [float]*81, "lowConfidenceCells": [int],
    #  "gridDetected": bool, "error": str | None, "legalityViolations": [int]}
"""
from __future__ import annotations

import os

import numpy as np
import onnxruntime as ort

import _pipeline

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "sudoku_digit_cnn.onnx")

# Confidence below which a recognised digit is flagged as unreliable.
# Fixture data (scripts/pick_threshold.py): correct predictions average 0.970
# confidence, wrong ones 0.781, but the tails overlap (min|correct 0.49,
# max|wrong 0.95). At 0.85 the flag catches 2 of the 3 fixture misreads
# (conf 0.63 and 0.76) while false-alarming 4.5% of correct cells; the 3rd
# misread (conf 0.95, a blurred photo) is uncatchable by confidence and also
# slips the legality check. Raising the threshold only adds false alarms
# without catching more, so 0.85 it is; legality violations are the more
# decisive net for real misreads.
CONFIDENCE_THRESHOLD = 0.85

_session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
_input_name = _session.get_inputs()[0].name


def _blank_result(error: str, grid_detected: bool = False) -> dict:
    return {
        "grid": "0" * 81,
        "confidences": [0.0] * 81,
        "lowConfidenceCells": [],
        "gridDetected": grid_detected,
        "error": error,
        "legalityViolations": [],
    }


def legality_violations(grid: str) -> list[int]:
    """Cell indices (0..80) that participate in a row/column/box with a repeated
    non-blank digit. Phase 0 found this flags exactly the images with misreads."""
    bad: set[int] = set()

    def check(units):
        for unit in units:
            seen: dict[str, list[int]] = {}
            for idx in unit:
                v = grid[idx]
                if v != "0":
                    seen.setdefault(v, []).append(idx)
            for idxs in seen.values():
                if len(idxs) > 1:
                    bad.update(idxs)

    rows = [[r * 9 + c for c in range(9)] for r in range(9)]
    cols = [[r * 9 + c for r in range(9)] for c in range(9)]
    boxes = [
        [(br * 3 + i) * 9 + (bc * 3 + j) for i in range(3) for j in range(3)]
        for br in range(3)
        for bc in range(3)
    ]
    check(rows)
    check(cols)
    check(boxes)
    return sorted(bad)


def _predict(cells: list[dict]) -> tuple[str, list[float]]:
    """cells: 81 dicts (row-major). Returns (grid_string, per_cell_confidence)."""
    digit_idx = [i for i, c in enumerate(cells) if c["contains_digit"]]
    grid = ["0"] * 81
    conf = [0.0] * 81
    if not digit_idx:
        return "".join(grid), conf

    batch = np.stack([cells[i]["img"][..., None] for i in digit_idx]).astype("float32")
    probs = _session.run(None, {_input_name: batch})[0]  # (n, 9); rescaling baked in
    preds = probs.argmax(axis=1) + 1
    confs = probs.max(axis=1)
    for k, i in enumerate(digit_idx):
        grid[i] = str(int(preds[k]))
        conf[i] = float(confs[k])
    return "".join(grid), conf


def recognize(image_bytes: bytes) -> dict:
    try:
        image_bgr = _pipeline.decode_image(image_bytes)
    except _pipeline.GridNotFound as exc:
        return _blank_result(str(exc), grid_detected=False)

    try:
        cells = _pipeline.extract_cells(image_bgr)
    except _pipeline.GridNotFound as exc:
        return _blank_result(f"grid detection failed: {exc}", grid_detected=False)

    grid, confidences = _predict(cells)

    low = {i for i in range(81) if grid[i] != "0" and confidences[i] < CONFIDENCE_THRESHOLD}
    violations = legality_violations(grid)
    low.update(violations)  # a constraint-violating cell is untrustworthy regardless

    error = None
    if violations:
        error = (
            f"recognised grid has {len(violations)} cell(s) in Sudoku-rule "
            f"conflicts (likely digit misreads)"
        )

    return {
        "grid": grid,
        "confidences": [round(c, 4) for c in confidences],
        "lowConfidenceCells": sorted(low),
        "gridDetected": True,
        "error": error,
        "legalityViolations": violations,
    }

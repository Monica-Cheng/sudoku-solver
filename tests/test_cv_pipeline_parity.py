"""The deployed CV path (api/_pipeline.py) and the reference CV path
(cnn/sudoku_utils.py) must segment every fixture grid identically.

_pipeline.py is a TensorFlow-free re-implementation of the grid-detection and
cell-segmentation half of sudoku_utils.py. This test locks the two together so
a change to one that isn't mirrored in the other fails here rather than silently
diverging the tested pipeline from the one that ships.

Needs the dev extras (cnn/sudoku_utils.py imports tensorflow / imutils /
matplotlib at module scope); skips cleanly without them.
"""
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, "tests", "fixtures")


def _load():
    sys.path.insert(0, os.path.join(ROOT, "api"))
    sys.path.insert(0, os.path.join(ROOT, "cnn"))
    import numpy as np

    import _pipeline
    import sudoku_utils as su

    return np, _pipeline, su


@pytest.fixture(scope="module")
def mods():
    try:
        return _load()
    except Exception as exc:  # pragma: no cover - dev extras optional
        pytest.skip(f"CV parity deps unavailable: {exc}")


def test_pipeline_matches_reference(mods):
    import json

    np, _pipeline, su = mods
    gt = json.load(open(os.path.join(FIX, "gt.json")))
    names = [k for k in gt if not k.startswith("_")]
    assert names, "no fixture images"

    for name in names:
        path = os.path.join(FIX, "images", name)

        # deployed path: bytes -> cells
        dep_cells = _pipeline.extract_cells(
            _pipeline.decode_image(open(path, "rb").read())
        )

        # reference path: the sudoku_utils sequence, same as the CNN test
        img = su.cv2.imread(path)
        img = su.cv2.cvtColor(img, su.cv2.COLOR_BGR2RGB)
        img = su.resize_and_maintain_aspect_ratio(input_image=img, new_width=1000)
        ref_cells, _M, _grid = su.get_valid_cells_from_image(img)

        assert len(dep_cells) == len(ref_cells) == 81, name
        for i, (d, r) in enumerate(zip(dep_cells, ref_cells)):
            assert d["contains_digit"] == bool(r["contains_digit"]), \
                f"{name} cell {i}: detector flag differs"
            assert np.array_equal(d["img"], r["img"]), \
                f"{name} cell {i}: 28x28 cell image differs"

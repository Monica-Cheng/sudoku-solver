"""CNN digit-recognition benchmark for the /benchmarks page.

Runs the real CNN/cv-sudoku-solver pipeline (TensorFlow + OpenCV) over the 24
fixture images and records:
  - per-digit accuracy and the full truth x prediction confusion matrix
  - the blank/digit detector's FP/FN
  - a preprocessing ablation: erode on/off, INTER_AREA vs INTER_NEAREST for the
    28x28 cell resize
  - confidence stats (mean when right / wrong, min|correct, max|wrong)

    .venv/bin/python benchmarks/run_cnn_bench.py

Writes benchmarks/results/cnn.json.
"""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CNN_DIR = os.path.join(REPO, "CNN", "cv-sudoku-solver")
FIX = os.path.join(REPO, "tests", "fixtures")
MODEL = os.path.join(CNN_DIR, "models", "model_fonts_mnist.keras")

sys.path.insert(0, CNN_DIR)
import numpy as np  # noqa: E402

# sudoku_utils.py predates NumPy 2, which dropped the np.reshape(newshape=...) kwarg.
_np_reshape = np.reshape
def _reshape_compat(a, newshape=None, shape=None, order="C", **kw):  # noqa: ANN001
    return _np_reshape(a, shape if shape is not None else newshape, order=order, **kw)
np.reshape = _reshape_compat

import tensorflow as tf  # noqa: E402
import sudoku_utils as su  # noqa: E402

cv2 = su.cv2
_real_erode = cv2.erode
_real_resize = cv2.resize


def configure(erode: bool, cell_interp):
    """Monkeypatch the two cell-preprocessing ops in sudoku_utils."""
    def erode_patch(src, kernel, iterations=1, **kw):
        return src if not erode else _real_erode(src, kernel, iterations=iterations, **kw)

    def resize_patch(src, dsize=None, fx=0, fy=0, interpolation=cv2.INTER_LINEAR, **kw):
        if dsize == (28, 28):
            interpolation = cell_interp
        return _real_resize(src, dsize, fx=fx, fy=fy, interpolation=interpolation, **kw)

    cv2.erode = erode_patch
    cv2.resize = resize_patch


def restore():
    cv2.erode = _real_erode
    cv2.resize = _real_resize


def evaluate(model, gt, want_confusion=False):
    """One full pass over the fixtures under the current preprocessing config."""
    N = ncorr = 0
    fp = fn = nblank = ndigit = 0
    conf_correct, conf_wrong = [], []
    confusion = {}          # (truth, pred) -> count
    per_image = []
    grids_exact = 0

    for name in sorted(gt, key=lambda s: (len(s), s)):
        path = os.path.join(FIX, "images", name)
        img = cv2.imread(path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = su.resize_and_maintain_aspect_ratio(input_image=img, new_width=1000)
        try:
            cells, _M, _b = su.get_valid_cells_from_image(img)
        except Exception:  # noqa: BLE001
            per_image.append((name, None))
            continue

        grid = su.get_predicted_sudoku_grid(model, cells).flatten()
        truth = [int(c) for c in gt[name]]

        di = np.array([np.expand_dims(c["img"], -1)
                       for c in cells if c["contains_digit"]]).astype("float32") / 255.0
        probs = model.predict(di, verbose=0)
        conf_by_slot = iter(probs.max(axis=1))

        img_err = 0
        for i, cell in enumerate(cells):
            is_digit_pred = bool(cell["contains_digit"])
            is_digit_gt = truth[i] != 0
            fp += is_digit_pred and not is_digit_gt
            fn += is_digit_gt and not is_digit_pred
            ndigit += is_digit_gt
            nblank += (not is_digit_gt)
            if is_digit_pred:
                c = float(next(conf_by_slot))
                if is_digit_gt:
                    N += 1
                    pred = int(grid[i])
                    if want_confusion:
                        confusion[f"{truth[i]}->{pred}"] = confusion.get(f"{truth[i]}->{pred}", 0) + 1
                    if pred == truth[i]:
                        ncorr += 1
                        conf_correct.append(c)
                    else:
                        conf_wrong.append(c)
                        img_err += 1
        grids_exact += all(
            (int(grid[i]) == truth[i])
            for i, cell in enumerate(cells)
            if cell["contains_digit"] and truth[i] != 0
        ) and (fn == 0)
        per_image.append((name, img_err))

    return {
        "cells_scored": N,
        "errors": N - ncorr,
        "accuracy": ncorr / N if N else None,
        "detector_fp": int(fp),
        "detector_fn": int(fn),
        "blank_cells": int(nblank),
        "digit_cells": int(ndigit),
        "conf_mean_correct": float(np.mean(conf_correct)) if conf_correct else None,
        "conf_mean_wrong": float(np.mean(conf_wrong)) if conf_wrong else None,
        "conf_min_correct": float(np.min(conf_correct)) if conf_correct else None,
        "conf_max_wrong": float(np.max(conf_wrong)) if conf_wrong else None,
        "confusion": confusion,
        "per_image_errors": {n: e for n, e in per_image if e},
        "cv_failures": [n for n, e in per_image if e is None],
    }


def main():
    gt = {k: v for k, v in json.load(open(os.path.join(FIX, "gt.json"))).items()
          if not k.startswith("_")}
    model = tf.keras.models.load_model(MODEL)

    out = {"n_images": len(gt), "model": os.path.basename(MODEL)}

    print("baseline: erode + INTER_AREA")
    configure(erode=True, cell_interp=cv2.INTER_AREA)
    out["baseline"] = evaluate(model, gt, want_confusion=True)
    print(f"  acc {out['baseline']['accuracy']:.4%}  errors {out['baseline']['errors']}"
          f"/{out['baseline']['cells_scored']}  confusion {out['baseline']['confusion']}")

    print("ablation: no erode, INTER_AREA")
    configure(erode=False, cell_interp=cv2.INTER_AREA)
    out["no_erode"] = evaluate(model, gt)
    print(f"  acc {out['no_erode']['accuracy']:.4%}  errors {out['no_erode']['errors']}")

    print("ablation: erode, INTER_NEAREST")
    configure(erode=True, cell_interp=cv2.INTER_NEAREST)
    out["inter_nearest"] = evaluate(model, gt)
    print(f"  acc {out['inter_nearest']['accuracy']:.4%}  errors {out['inter_nearest']['errors']}")

    print("ablation: no erode, INTER_NEAREST")
    configure(erode=False, cell_interp=cv2.INTER_NEAREST)
    out["no_erode_inter_nearest"] = evaluate(model, gt)
    print(f"  acc {out['no_erode_inter_nearest']['accuracy']:.4%}  errors {out['no_erode_inter_nearest']['errors']}")

    restore()
    b = out["baseline"]["accuracy"]
    out["ablation_deltas_pp"] = {
        "erode": (b - out["no_erode"]["accuracy"]) * 100,
        "inter_area_vs_nearest": (b - out["inter_nearest"]["accuracy"]) * 100,
        "both": (b - out["no_erode_inter_nearest"]["accuracy"]) * 100,
    }
    print("deltas (pp):", out["ablation_deltas_pp"])

    os.makedirs(f"{REPO}/benchmarks/results", exist_ok=True)
    dst = f"{REPO}/benchmarks/results/cnn.json"
    json.dump(out, open(dst, "w"), indent=1)
    print("->", dst)


if __name__ == "__main__":
    main()

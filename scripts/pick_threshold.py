"""Confidence-threshold sweep + end-to-end accuracy on the 24 fixture images.

Uses only the deployed pipeline (api/_pipeline + api/_infer) - no TensorFlow.

    .venv/bin/python scripts/pick_threshold.py
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

import _infer, _pipeline  # noqa: E402

GT = {k: v for k, v in json.load(
    open(os.path.join(ROOT, "tests", "fixtures", "gt.json"))
).items() if not k.startswith("_")}


def main():
    conf_correct: list[float] = []
    conf_wrong: list[float] = []
    grids_exact = 0
    per_image = []
    cv_fail = []

    for name in sorted(GT, key=lambda s: (len(s), s)):
        path = os.path.join(ROOT, "tests", "fixtures", "images", name)
        try:
            img = _pipeline.decode_image(open(path, "rb").read())
            cells = _pipeline.extract_cells(img)
        except _pipeline.GridNotFound as e:
            cv_fail.append((name, str(e)))
            continue

        grid, confs = _infer._predict(cells)
        truth = GT[name]

        errs = 0
        for i, c in enumerate(cells):
            if not c["contains_digit"] or truth[i] == "0":
                continue  # only score detector-and-gt-agree digit cells
            correct = grid[i] == truth[i]
            (conf_correct if correct else conf_wrong).append(confs[i])
            if not correct:
                errs += 1
        grids_exact += grid == truth
        per_image.append((name, errs, grid == truth))

    cc = np.array(conf_correct)
    cw = np.array(conf_wrong)
    n = len(cc) + len(cw)
    print(f"scored {len(per_image)} images   (cv failures: {cv_fail})")
    print(f"digit cells scored: {n}   correct {len(cc)}   wrong {len(cw)}  "
          f"(per-digit accuracy {len(cc)/n:.4%})")
    print(f"confidence  mean|correct = {cc.mean():.4f}   mean|wrong = {cw.mean():.4f}")
    print(f"            min |correct = {cc.min():.4f}   max  |wrong = {cw.max():.4f}")
    print(f"grids exactly matching GT: {grids_exact}/{len(per_image)}")
    print(f"imperfect grids: {[(n_, e) for n_, e, ok in per_image if not ok]}")

    print("\nthreshold sweep  (FP = correct cell flagged; FN = wrong cell NOT flagged):")
    print(f"{'thr':>5} {'flagged':>8} {'FP':>4} {'FP%':>7} {'FN':>4} {'FN%':>7}")
    for thr in [0.70, 0.75, 0.80, 0.85, 0.88, 0.90, 0.92, 0.95, 0.97]:
        fp = int((cc < thr).sum())
        fn = int((cw >= thr).sum())
        flagged = int((cc < thr).sum() + (cw < thr).sum())
        print(f"{thr:5.2f} {flagged:8d} {fp:4d} {fp/len(cc):7.2%} {fn:4d} {fn/len(cw):7.2%}")


if __name__ == "__main__":
    main()

"""Regression check for the CNN digit recogniser against tests/fixtures/.

Run:  python tests/test_cnn_recognition.py
Needs: tensorflow, opencv-python, imutils, numpy, matplotlib (same as the repo).

Loads every image in fixtures/gt.json, runs the real
CNN/cv-sudoku-solver pipeline (grid detection -> cell segmentation ->
get_predicted_sudoku_grid), and compares to the transcribed givens.

Baseline (model_fonts_mnist.keras, /255 normalisation, erode + INTER_AREA):
  per-digit accuracy      99.55 %   (3 errors / 667 detector-confirmed cells)
  blank/digit detector    0 errors / 1944 cells
  mean confidence         ~0.97
  confidence when wrong    ~0.78     (was ~1.00 on un-normalised 0-255 input)
"""
import json
import os
import sys

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CNN_DIR = os.path.join(REPO, "CNN", "cv-sudoku-solver")
FIX = os.path.join(REPO, "tests", "fixtures")
sys.path.insert(0, CNN_DIR)

import tensorflow as tf  # noqa: E402
import sudoku_utils as su  # noqa: E402

MODEL = os.path.join(CNN_DIR, "models", "model_fonts_mnist.keras")


def main():
    gt = {k: v for k, v in json.load(open(os.path.join(FIX, "gt.json"))).items()
          if not k.startswith("_")}
    model = tf.keras.models.load_model(MODEL)

    N = ncorr = 0
    fp = fn = nblank = ndigit = 0
    conf_wrong, conf_all = [], []
    cv_fail = []
    per_image = []

    for name in sorted(gt, key=lambda s: (len(s), s)):
        path = os.path.join(FIX, "images", name)
        img = su.cv2.imread(path)
        img = su.cv2.cvtColor(img, su.cv2.COLOR_BGR2RGB)
        img = su.resize_and_maintain_aspect_ratio(input_image=img, new_width=1000)
        try:
            cells, _M, _board = su.get_valid_cells_from_image(img)
        except Exception as e:  # noqa: BLE001
            cv_fail.append((name, str(e)))
            continue

        grid = su.get_predicted_sudoku_grid(model, cells).flatten()
        truth = [int(c) for c in gt[name]]

        # confidence: mirror get_predicted_sudoku_grid's preprocessing
        di = np.array([np.expand_dims(c["img"], -1)
                       for c in cells if c["contains_digit"]]).astype("float32") / 255.0
        probs = model.predict(di, verbose=0)
        conf_by_slot = iter(probs.max(axis=1))

        img_err = 0
        for i, cell in enumerate(cells):
            is_digit_pred = cell["contains_digit"]
            is_digit_gt = truth[i] != 0
            if is_digit_pred and not is_digit_gt:
                fp += 1
            if is_digit_gt and not is_digit_pred:
                fn += 1
            ndigit += is_digit_gt
            nblank += (not is_digit_gt)
            if is_digit_pred:
                c = next(conf_by_slot)
                if is_digit_gt:
                    N += 1
                    conf_all.append(c)
                    if grid[i] == truth[i]:
                        ncorr += 1
                    else:
                        conf_wrong.append(c)
                        img_err += 1
        per_image.append((name, img_err))

    acc = ncorr / N if N else float("nan")
    print(f"images scored          {len(per_image)}   (cv failures: {cv_fail})")
    print(f"per-digit accuracy     {acc:.4%}   ({N - ncorr} errors / {N} cells)")
    print(f"blank/digit detector   FP={fp} FN={fn}   / {nblank} blank + {ndigit} digit")
    print(f"mean confidence        {np.mean(conf_all):.4f}")
    print(f"confidence when wrong  {(np.mean(conf_wrong) if conf_wrong else float('nan')):.4f}")
    print("per-image errors:      " + ", ".join(f"{n}:{e}" for n, e in per_image if e))

    ok = True
    if acc < 0.995:
        print(f"FAIL: accuracy {acc:.4%} < 99.5%"); ok = False
    if fp + fn != 0:
        print(f"FAIL: detector errors {fp + fn} != 0"); ok = False
    if conf_wrong and np.mean(conf_wrong) > 0.85:
        print(f"FAIL: confidence-when-wrong {np.mean(conf_wrong):.3f} > 0.85 "
              f"(normalisation not applied?)"); ok = False
    print("OK" if ok else "REGRESSION")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

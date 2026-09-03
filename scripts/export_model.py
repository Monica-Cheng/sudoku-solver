"""Export the digit CNN to ONNX with a Rescaling(1/255) layer baked in, then
verify it matches the Keras original on the fixture cells.

Dev-only (needs tensorflow / keras / tf2onnx). NOT part of the deployed API.

    .venv/bin/python scripts/export_model.py
"""
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

KERAS_MODEL = os.path.join(ROOT, "CNN", "cv-sudoku-solver", "models", "model_fonts_mnist.keras")
OUT = os.path.join(ROOT, "api", "model", "sudoku_digit_cnn.onnx")


def fixture_digit_cells():
    """Run the TF-free pipeline over the 24 fixture images; return every cell
    the detector flags as containing a digit, as uint8 (N, 28, 28, 1)."""
    import json
    import cv2  # noqa: F401  (import check)
    import _pipeline

    gt = json.load(open(os.path.join(ROOT, "tests", "fixtures", "gt.json")))
    names = [k for k in gt if not k.startswith("_")]
    cells = []
    for name in names:
        path = os.path.join(ROOT, "tests", "fixtures", "images", name)
        img = _pipeline.decode_image(open(path, "rb").read())
        for c in _pipeline.extract_cells(img):
            if c["contains_digit"]:
                cells.append(c["img"])
    return np.array(cells, dtype=np.uint8)[..., None]


def main():
    import keras
    import tensorflow as tf

    model = keras.saving.load_model(KERAS_MODEL)
    print(f"loaded {KERAS_MODEL}  ({model.count_params():,} params)")

    inputs = keras.Input(shape=(28, 28, 1), dtype="float32", name="cell")
    x = keras.layers.Rescaling(1.0 / 255.0, name="rescale_1_255")(inputs)
    outputs = model(x)
    wrapped = keras.Model(inputs, outputs, name="sudoku_digit_cnn")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    spec = (tf.TensorSpec((None, 28, 28, 1), tf.float32, name="cell"),)
    wrapped.export(OUT, format="onnx", input_signature=spec, verbose=False)
    size = os.path.getsize(OUT)
    print(f"exported -> {OUT}  ({size/1e6:.3f} MB)")

    # ---- parity: ONNX(raw 0-255) vs Keras(original)(/255) --------------------
    import onnxruntime as ort

    cells_u8 = fixture_digit_cells()
    print(f"parity batch: {len(cells_u8)} fixture digit cells")

    x_raw = cells_u8.astype("float32")
    x_scaled = x_raw / 255.0

    y_keras = model.predict(x_scaled, verbose=0)  # original model, manual /255

    sess = ort.InferenceSession(OUT, providers=["CPUExecutionProvider"])
    iname = sess.get_inputs()[0].name
    y_onnx = sess.run(None, {iname: x_raw})[0]  # baked rescaling, feed raw 0-255

    max_abs = float(np.max(np.abs(y_onnx - y_keras)))
    argmax_agree = float(np.mean(np.argmax(y_onnx, 1) == np.argmax(y_keras, 1)))
    print(f"  max |Δ probs|      = {max_abs:.3e}")
    print(f"  argmax agreement   = {argmax_agree:.4%}")

    # sanity: the baked rescaling really is there (raw vs pre-scaled input differ)
    y_onnx_wrong = sess.run(None, {iname: x_scaled})[0]
    still_ok = np.mean(np.argmax(y_onnx_wrong, 1) == np.argmax(y_keras, 1))
    print(f"  (feeding pre-/255 input to the ONNX model: argmax agree {still_ok:.2%} "
          f"-> confirms rescaling is inside the graph)")

    ok = max_abs < 1e-4 and argmax_agree == 1.0
    print("OK" if ok else "PARITY MISMATCH")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

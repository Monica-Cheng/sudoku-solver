"""Train the digit CNN (MNIST 1-9 + a font-rendered digit set) and save it as
``model_fonts_mnist.keras``. This is the script that produced the checked-in
``cnn/models/model_fonts_mnist.keras``; the font dataset it needs
(``data/digit_images/<1..9>/*.png``) is not in the repo.

    python cnn/train.py --data-dir path/to/digit_images --out cnn/models/model_fonts_mnist.keras
"""
import argparse
import glob
import os

import cv2
import numpy as np
from tensorflow.keras.datasets import mnist
from tensorflow.keras.layers import Conv2D, Dense, Dropout, Flatten, MaxPooling2D
from tensorflow.keras.models import Sequential
from tensorflow.keras.utils import to_categorical

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA_DIR = os.path.join(_HERE, "data", "digit_images")
DEFAULT_OUT = os.path.join(_HERE, "models", "model_fonts_mnist.keras")

# 1️ Load MNIST (digits 1–9 only)
def load_mnist_data():
    (x_train, y_train), (x_test, y_test) = mnist.load_data()

    # Remove zeros (Sudoku uses 1–9)
    train_filter = np.where(y_train != 0)
    test_filter = np.where(y_test != 0)
    x_train, y_train = x_train[train_filter], y_train[train_filter]
    x_test, y_test = x_test[test_filter], y_test[test_filter]

    # Normalize
    x_train = x_train.astype("float32") / 255.0
    x_test = x_test.astype("float32") / 255.0

    # Add channel dimension
    x_train = np.expand_dims(x_train, -1)
    x_test = np.expand_dims(x_test, -1)

    # One-hot encode (1–9 → 0–8)
    y_train -= 1
    y_test -= 1
    y_train = to_categorical(y_train, 9)
    y_test = to_categorical(y_test, 9)

    print(f" Loaded MNIST digits: {x_train.shape[0]} train, {x_test.shape[0]} test")
    return x_train, y_train, x_test, y_test

# 2️ Load FONT dataset (supports both “1–9” and “Sample002–010” folders)
def load_font_data(data_dir=DEFAULT_DATA_DIR):
    x, y = [], []

    # Detect folder naming pattern automatically
    subfolders = sorted(glob.glob(os.path.join(data_dir, "*")))
    if not subfolders:
        raise ValueError(f" No subfolders found in {data_dir}")

    # Check if folders are named "1", "2", ..., or "Sample002" etc.
    if "Sample002" in subfolders[0]:
        pattern_type = "sample"
        print(" Detected SampleXXX folder pattern")
        folder_mapping = [(i + 1, f"Sample{(i + 2):03d}") for i in range(9)]
    else:
        pattern_type = "numeric"
        print(" Detected numeric folder pattern (1–9)")
        folder_mapping = [(i + 1, str(i + 1)) for i in range(9)]

    # Load images
    for digit, folder_name in folder_mapping:
        folder = os.path.join(data_dir, folder_name)
        if not os.path.exists(folder):
            print(f" Missing folder: {folder}")
            continue

        img_paths = glob.glob(os.path.join(folder, "*.png"))
        if len(img_paths) == 0:
            print(f" No PNGs in {folder}")
            continue

        for img_path in img_paths:
            img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            img = cv2.resize(img, (28, 28))
            img = cv2.bitwise_not(img)  # make digits white on black background
            img = img.astype("float32") / 255.0
            x.append(img)
            y.append(digit - 1)

        print(f" Loaded {len(img_paths)} images for digit {digit} ({folder_name})")

    if len(x) == 0:
        raise ValueError(f"No images found in {data_dir}")

    x = np.array(x)
    x = np.expand_dims(x, -1)
    y = np.array(y)
    y = to_categorical(y, 9)

    print(f" Total font digits loaded: {x.shape[0]}")
    return x, y

# 3️ Build CNN
def build_model():
    model = Sequential([
        Conv2D(32, (3, 3), activation="relu", input_shape=(28, 28, 1)),
        MaxPooling2D(pool_size=(2, 2)),
        Conv2D(64, (3, 3), activation="relu"),
        MaxPooling2D(pool_size=(2, 2)),
        Flatten(),
        Dropout(0.5),
        Dense(128, activation="relu"),
        Dense(9, activation="softmax")
    ])
    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    return model

# 4️ Train and Save
def train_model(data_dir=DEFAULT_DATA_DIR, out_path=DEFAULT_OUT):
    x_train_m, y_train_m, x_test_m, y_test_m = load_mnist_data()
    x_font, y_font = load_font_data(data_dir)

    # Match dataset sizes before combining
    min_len = min(len(x_train_m), len(x_font))
    x_combined = np.concatenate((x_train_m[:min_len], x_font[:min_len]))
    y_combined = np.concatenate((y_train_m[:min_len], y_font[:min_len]))

    # Shuffle
    indices = np.arange(len(x_combined))
    np.random.shuffle(indices)
    x_combined = x_combined[indices]
    y_combined = y_combined[indices]

    print(f"Combined dataset shape: {x_combined.shape}")

    model = build_model()
    model.fit(
        x_combined,
        y_combined,
        validation_split=0.15,
        epochs=15,
        batch_size=128,
        verbose=1
    )

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    model.save(out_path)
    print(f"Model saved to {out_path}")


# 5️ Run script
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--data-dir", default=DEFAULT_DATA_DIR,
                    help="font digit-image dataset (subfolders 1..9 or Sample002..010)")
    ap.add_argument("--out", default=DEFAULT_OUT, help="output .keras path")
    args = ap.parse_args()
    train_model(args.data_dir, args.out)

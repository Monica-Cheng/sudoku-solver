# CNN recognition regression fixtures

Frozen baseline for the photo → 9×9 grid pipeline in `cnn/`.
Use it to check that changes to the vision code (grid detection, cell
segmentation, preprocessing, the model) do not regress digit-recognition
accuracy.

## Contents

| path | what |
|---|---|
| `gt.json` | ground-truth givens for 24 images: `{ "<file>.jpg": "<81 chars>" }`, row-major, `0` = blank |
| `images/` | the 24 source photos `gt.json` refers to (originally from the `cnn/` project's `data/sudoku_images/`, which is not in this repo) |
| `predictions/pred_<n>.txt` | what the pipeline produced at the time the baseline was captured — two 9×9 blocks per file: `RAW` (0–255 input, the old shipped behaviour) and `NORMALIZED` (`/255`) |

25 prediction files are kept (every image that survives grid detection).
`gt.json` covers 24 of them — `25.jpg` is too blurred to hand-transcribe; `4.jpg`
is absent everywhere because grid detection fails on it (only 75 cell contours
found instead of 81).

## How the ground truth was produced

1. Ran `get_valid_cells_from_image` + `get_predicted_sudoku_grid` on every image
   in `data/sudoku_images/`. 25 / 26 yield exactly 81 cells (`4.jpg` fails).
2. For each survivor, rendered the 81 deskewed 28×28 cells (the exact tensors the
   CNN classifies) as a 9×9 montage and transcribed the visible digit in each
   cell by eye.
3. Validated every transcribed grid: it must be a legal Sudoku (no repeated
   digit in any row/column/box) **and** have exactly one solution. This caught
   ~5 transcription slips, which were corrected. `23.jpg` is the one grid that
   stays multi-solution (sparse puzzle + one uncertain cell, r6c4).

Duplicate photos of the same physical puzzle share a grid: `1==22`, `6==7==8==9`,
`11==12`, `16==17`, `18==19` — so the 24 images are 16 distinct puzzles.

## Baseline numbers (model `models/model_fonts_mnist.keras`, `erode` + `INTER_AREA`)

Measured on the 667 cells where the blank/digit detector and `gt.json` agree a
digit is present:

| input | per-digit accuracy | errors | mean confidence | confidence when wrong |
|---|---|---|---|---|
| raw 0–255 (old) | 98.95 % | 7 | 0.9996 | 1.0000 |
| `/255` (current) | **99.55 %** | **3** | 0.969 | 0.78 |

Blank-vs-digit detector (5 % contour-area rule): 0 errors / 1944 cells.
Only digit confused: **9** (→ 7 or 8). Remaining `/255` misreads: `11.jpg` r8c2
(9→8), `17.jpg` r8c1 (4→5), `23.jpg` r6c4 (9→7).

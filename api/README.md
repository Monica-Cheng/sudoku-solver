# Inference API — image → Sudoku grid

`POST` an image, get the recognised grid as JSON.

```
POST /api          Content-Type: image/*  or  multipart/form-data
```

```jsonc
{
  "grid": "004300209005009001...",   // 81 chars, "0" = blank
  "confidences": [0, 0, 0, 0.98, ...],// per cell, 0 for blanks
  "lowConfidenceCells": [12, 47],     // indices below the confidence threshold
                                      //   OR in a Sudoku-rule conflict
  "gridDetected": true,
  "error": null,                      // string when detection fails, or a
                                      //   "grid has N rule conflicts" warning
  "legalityViolations": [9, 55, 63]   // cells in a row/col/box conflict
}
```

* **`gridDetected: false` + `error`** → hard failure (undecodable bytes, no grid
  found, grid didn't segment into 81 cells). Returns HTTP 422, never 500.
* **`gridDetected: true` + `error` non-null** → grid recognised but has
  Sudoku-rule conflicts, i.e. probable misreads. Still usable.
* HTTP 413 for uploads over 8 MB, 405 for non-POST, 400 for an empty body.

## Files

| file | role | deps |
|---|---|---|
| `_pipeline.py` | grid detection · perspective correction · cell segmentation | `opencv-python-headless`, `numpy` |
| `_infer.py` | ONNX digit recognition, confidence, legality check; **loads the model once at import** | `+ onnxruntime` |
| `index.py` | the Vercel `handler` (stdlib `BaseHTTPRequestHandler`) | stdlib only |
| `model/sudoku_digit_cnn.onnx` | the CNN with `Rescaling(1/255)` baked in (0.90 MB) | — |
| `requirements.txt` | the three deployed dependencies | — |

No TensorFlow, matplotlib, imutils, or file I/O on the request path.

## Local dev

```
.venv/bin/python dev_server.py          # http://localhost:8000/api
curl -s --data-binary @../tests/fixtures/images/1.jpg \
     -H 'Content-Type: image/jpeg' http://localhost:8000/api | python -m json.tool
```

## Confidence threshold

`CONFIDENCE_THRESHOLD = 0.85` (see `scripts/pick_threshold.py`). On the 24
fixtures: per-digit accuracy 99.55 %, 21/24 grids exact. Of the 3 misreads,
`0.85 + legality` flags 2; the third is a confident misread on a blurred photo
that slips both nets.

## Deployment size

Measured Linux x86_64, unzipped: **≈ 278 MB** (`opencv-python-headless` 139 MB,
`numpy` 64 MB, `onnxruntime` 46 MB, `sympy` 29 MB). This **exceeds Vercel's
250 MB limit by ~28 MB.** The `handler` is a plain `BaseHTTPRequestHandler`, so
it runs unchanged on any host without that limit (Fly.io / Cloud Run / a
container / AWS Lambda with a larger package).

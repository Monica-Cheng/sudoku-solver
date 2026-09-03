"""Vercel Python serverless function: POST an image, get the recognised grid.

    POST /api  (image/*  or  multipart/form-data)
    -> 200 { grid, confidences, lowConfidenceCells, gridDetected, error, legalityViolations }
       422 same shape when the grid could not be detected
       413 same shape when the upload is too large
       405 for non-POST

Every recognised-image path returns JSON, never a 500 - grid-detection failure,
undecodable bytes, and a photo with no Sudoku all come back as
`gridDetected: false` with a message in `error`.

The ONNX model is loaded once, at import time (module scope), by `_infer`.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _infer  # noqa: E402  - side effect: builds the onnxruntime session

MAX_IMAGE_BYTES = 8 * 1024 * 1024      # reject uploads larger than this
HARD_READ_CEILING = 32 * 1024 * 1024   # never buffer more than this


def _extract_image_bytes(content_type: str, raw: bytes) -> bytes:
    """Accept either a raw image body or the first file part of a multipart form."""
    if not content_type.lower().startswith("multipart/form-data"):
        return raw
    marker = "boundary="
    if marker not in content_type:
        return raw
    boundary = ("--" + content_type.split(marker, 1)[1].strip().strip('"')).encode()
    parts = raw.split(boundary)
    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        head, _, body = part.partition(b"\r\n\r\n")
        if b"filename=" in head or b"Content-Type: image" in head:
            return body
    # no file part found; fall back to the whole body
    return raw


class handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # -- helpers ---------------------------------------------------------
    def _json(self, obj: dict, status: int = 200) -> None:
        payload = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *_args):  # quiet by default
        pass

    # -- routes --------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self._json(
            {"status": "ok", "usage": "POST an image (image/* or multipart/form-data)"},
            200,
        )

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0

        if length <= 0:
            return self._json(_err("empty request body"), 400)
        if length > HARD_READ_CEILING:
            return self._json(
                _err(f"upload too large ({length / 1e6:.1f} MB); limit "
                     f"{MAX_IMAGE_BYTES / 1e6:.0f} MB"),
                413,
            )

        raw = self.rfile.read(length)
        if len(raw) > MAX_IMAGE_BYTES:
            return self._json(
                _err(f"upload too large ({len(raw) / 1e6:.1f} MB); limit "
                     f"{MAX_IMAGE_BYTES / 1e6:.0f} MB"),
                413,
            )

        image_bytes = _extract_image_bytes(self.headers.get("Content-Type", ""), raw)

        try:
            result = _infer.recognize(image_bytes)
        except Exception as exc:  # never a 500
            return self._json(_err(f"internal recognition error: {type(exc).__name__}"), 200)

        return self._json(result, 200 if result["gridDetected"] else 422)

    def do_PUT(self):
        self._json(_err("method not allowed; POST an image"), 405)

    do_DELETE = do_PUT
    do_PATCH = do_PUT


def _err(message: str) -> dict:
    return _infer._blank_result(message, grid_detected=False)

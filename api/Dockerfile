# Inference API — build context is this directory (api/), which is
# self-contained: _infer.py / _pipeline.py have no dependency on the repo's
# solvers/ package. Build with:
#
#     docker build -t sudoku-solver-api api/
#
# from the repo root, or `docker build -t sudoku-solver-api .` from inside
# api/.

FROM python:3.11-slim

WORKDIR /app

# opencv-python-headless still dynamically links against libGL / libglib at
# import time even though it ships no GUI code; without these the container
# crashes on `import cv2` with "libGL.so.1: cannot open shared object file".
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["python", "dev_server.py"]

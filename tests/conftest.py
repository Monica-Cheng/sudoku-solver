import os

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUZZLE_DIR = os.path.join(ROOT, "puzzles")
BENCH_DIR = os.path.join(ROOT, "benchmarks")


def _read(path):
    d = "".join(c for c in open(path).read() if c.isdigit())
    return [d[i:i + 81] for i in range(0, len(d), 81) if i + 81 <= len(d)]


@pytest.fixture(scope="session")
def puzzle_sets():
    return {
        "easy": _read(os.path.join(PUZZLE_DIR, "easy.txt")),
        "medium": _read(os.path.join(PUZZLE_DIR, "medium.txt")),
        "hard": _read(os.path.join(PUZZLE_DIR, "hard.txt")),
    }


@pytest.fixture(scope="session")
def bench_hard():
    return _read(os.path.join(BENCH_DIR, "hard.txt"))


@pytest.fixture(scope="session")
def easy(puzzle_sets):
    return puzzle_sets["easy"]

"""Cell addressing helpers.

Every solver and every emitted event refers to a cell by a single integer
index 0..80, row-major (index = row * 9 + col), which is also the position of
that cell in the 81-character puzzle string.

Algo3 internally names cells "A1".."I9" (letter = row A..I, digit = column
1..9); ``coord_to_index`` / ``index_to_coord`` bridge the two.
"""

_ROW_LETTERS = "ABCDEFGHI"


def coord_to_index(coord: str) -> int:
    """'A1' -> 0, 'A2' -> 1, ..., 'I9' -> 80."""
    row = _ROW_LETTERS.index(coord[0])
    col = int(coord[1]) - 1
    return row * 9 + col


def index_to_coord(index: int) -> str:
    """0 -> 'A1', ..., 80 -> 'I9'."""
    row, col = divmod(index, 9)
    return f"{_ROW_LETTERS[row]}{col + 1}"


def rc_to_index(row: int, col: int) -> int:
    return row * 9 + col

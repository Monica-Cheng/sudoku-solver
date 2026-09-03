# Modified from: Sawyer Bailey Paccione, Tufts University, 2020
# Original repository: https://github.com/paccionesawyer/sudokuSolver-CSP
# License: MIT
#
# Unchanged from Algo2/SudokuBoard.py except: relative import, and a
# from_string() constructor so callers don't need io.StringIO.
import io
from copy import deepcopy

from .error import SudokuError


class SudokuBoard(object):
    def __init__(self, input_file):
        self.__initialize_board(input_file)
        self.unique_states = 1
        self.conflict_stacks = [[[] for j in range(9)] for i in range(9)]
        self.backjump = [-1, -1]
        self.gameover = False
        self.backtracks = 0

    @classmethod
    def from_string(cls, puzzle: str) -> "SudokuBoard":
        return cls(io.StringIO(puzzle))

    def start_over(self):
        self.board = deepcopy(self.start_board)

    def print_board(self):
        for i in range(9):
            if i > 0 and i % 3 == 0:
                print("- - - - - - - - - - -")
            for j in range(9):
                print(self.board[i][j], end=" ")
                if (j + 1) % 3 == 0 and j != 8:
                    print("|", end=" ")
            print()

    def valid_input(self, row, col, num):
        return (self.__valid_box(row, col, num)
                and self.__valid_row(row, col, num)
                and self.__valid_col(row, col, num))

    def combine_conflicts(self, source, dest):
        for to_add in reversed(source):
            if to_add not in dest:
                dest.insert(0, to_add)

    def check_win(self):
        for i in range(len(self.board)):
            for j in range(len(self.board[i])):
                if not self.valid_input(i, j, self.board[i][j]):
                    return False
        self.gameover = True
        return True

    def __initialize_board(self, input):
        content = input.read().strip().replace(" ", "").replace("\n", "")
        if len(content) != 81:
            raise SudokuError("Invalid Sudoku file format: must contain 81 digits.")
        self.board = [[0 for _ in range(9)] for _ in range(9)]
        idx = 0
        for i in range(9):
            for j in range(9):
                char = content[idx]
                if not char.isdigit():
                    raise SudokuError("File must contain only digits 0-9.")
                self.board[i][j] = int(char)
                idx += 1
        input.close()
        self.start_board = deepcopy(self.board)

    def __valid_table(self):
        for i in range(len(self.board)):
            for j in range(len(self.board[i])):
                if (self.board[i][j] != 0
                        and not self.valid_input(i, j, self.board[i][j])):
                    print([i, j])
                    return False
        return True

    def __valid_box(self, row, col, num):
        box_x = col // 3
        box_y = row // 3
        for i in range(box_y * 3, box_y * 3 + 3):
            for j in range(box_x * 3, box_x * 3 + 3):
                if (self.board[i][j] == num and i != row and j != col):
                    return False
        return True

    def __valid_row(self, row, col, num):
        for j in range(len(self.board[row])):
            if (self.board[row][j] == num and col != j):
                return False
        return True

    def __valid_col(self, row, col, num):
        for i in range(len(self.board)):
            if (self.board[i][col] == num and row != i):
                return False
        return True

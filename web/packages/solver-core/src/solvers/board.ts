/** Port of solvers/forward_checking/board.py (SudokuBoard). Behaviour-identical,
 * including the quirk in __valid_box that ignores same-row / same-column cells. */
export class SudokuBoard {
  board: number[][];
  uniqueStates = 1;
  backtracks = 0;

  private constructor(board: number[][]) {
    this.board = board;
  }

  static fromString(puzzle: string): SudokuBoard {
    const content = puzzle.replace(/\s/g, "");
    if (content.length !== 81) {
      throw new Error("Invalid Sudoku file format: must contain 81 digits.");
    }
    const board: number[][] = [];
    let idx = 0;
    for (let i = 0; i < 9; i++) {
      const row: number[] = [];
      for (let j = 0; j < 9; j++) {
        const ch = content[idx++];
        if (ch < "0" || ch > "9") throw new Error("File must contain only digits 0-9.");
        row.push(Number(ch));
      }
      board.push(row);
    }
    return new SudokuBoard(board);
  }

  validInput(row: number, col: number, num: number): boolean {
    return (
      this.validBox(row, col, num) &&
      this.validRow(row, col, num) &&
      this.validCol(row, col, num)
    );
  }

  private validBox(row: number, col: number, num: number): boolean {
    const boxX = Math.floor(col / 3);
    const boxY = Math.floor(row / 3);
    for (let i = boxY * 3; i < boxY * 3 + 3; i++) {
      for (let j = boxX * 3; j < boxX * 3 + 3; j++) {
        if (this.board[i][j] === num && i !== row && j !== col) return false;
      }
    }
    return true;
  }

  private validRow(row: number, col: number, num: number): boolean {
    for (let j = 0; j < 9; j++) {
      if (this.board[row][j] === num && col !== j) return false;
    }
    return true;
  }

  private validCol(row: number, col: number, num: number): boolean {
    for (let i = 0; i < 9; i++) {
      if (this.board[i][col] === num && row !== i) return false;
    }
    return true;
  }
}

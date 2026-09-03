import cv2
import os
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
import argparse

import sudoku_utils as sutils
from sudoku_solver_class import SudokuSolver


def solve_sudoku_puzzle(args):
    img_fpath = args['img_fpath']
    model_fpath = args['model_fpath']
    
    # Check for valid filepath because cv2.imread fails silently
    if not os.path.exists(img_fpath):
        raise FileNotFoundError (f"File not found: '{img_fpath}'")
    # Load image, change color space from BGR to RGB, and resize
    img = cv2.imread(img_fpath)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = sutils.resize_and_maintain_aspect_ratio(input_image=img, new_width=1000)
    
    # Plot the original image
    fig, ax = plt.subplots()
    ax.imshow(img)
    ax.axis('off')
    plt.tight_layout()
    plt.show(block=False)

    # Load the trained model and make prediction
    loaded_model = tf.keras.models.load_model(model_fpath)

    # Locate grid cells in image
    cells, M, board_image = sutils.get_valid_cells_from_image(img)

    # Get the 2D array of the puzzle grid to be passed to the solver
    grid_array = sutils.get_predicted_sudoku_grid(loaded_model, cells)
    # Just display the recognized grid (no solving)
    print("\nScanned Sudoku Puzzle (0 = empty cell):\n")
    from sudoku_solver_class import SudokuSolver
    scanner = SudokuSolver(board=grid_array)
    scanner.print_board()

    # New file writing code for sudoku_main.py
    # --- Start of Replacement Block ---
    output_path = args['output_path']
    # Flatten the 9x9 grid_array into a single list of 81 digits
    flattened_grid = grid_array.flatten()
    
    # Convert all numbers to strings and join them without any spaces
    # Example: [1, 2, 3, 0] becomes "1230"
    single_line_content = "".join(str(x) for x in flattened_grid)
    
    # Write the single line to the output file
    with open(output_path, "w") as f:
        f.write(single_line_content)
        
    print(f"\n Saved recognized grid to {output_path} (81 digits, single line)")
    # --- End of Replacement Block ---

if __name__ == "__main__":
    # Construct an argument parser and parse the arguments
    ap = argparse.ArgumentParser()
    ap.add_argument("--img_fpath", default="../../tests/fixtures/images/22.jpg", type=str, help="Path to sudoku image file")
    ap.add_argument("--model_fpath", default="/Users/monicacheng/Desktop/Sudoku_git/Soduky/CNN/cv-sudoku-solver/models/model_fonts_mnist.keras", type=str, help="Path to saved Keras CNN model")
    ap.add_argument("--output_path", default="/content/recognized_sudoku.txt", type=str, help="Path to save recognized Sudoku text file")
    args = vars(ap.parse_args())

    solve_sudoku_puzzle(args)
    plt.show()

    


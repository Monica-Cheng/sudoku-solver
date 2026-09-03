import os
import sys
import argparse
import cv2
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
import tempfile
import time
import tracemalloc
from pathlib import Path

# Add paths for imports
SCRIPT_DIR = Path(__file__).parent
CNN_DIR = SCRIPT_DIR / "CNN" / "cv-sudoku-solver"
ALGO3_DIR = SCRIPT_DIR / "Algo3"

# Add directories to path
sys.path.insert(0, str(CNN_DIR))
sys.path.insert(0, str(ALGO3_DIR))

# Import CNN modules
import sudoku_utils as sutils
from sudoku_solver_class import SudokuSolver as CNNSolver

# Import Algorithm 3 modules
from sudoku import Sudoku
from ac3 import AC3
from backtrack import recursive_backtrack_algorithm
from heuristics import select_unassigned_variable, order_domain_values
from utils import is_consistent, assign, unassign


class IntegratedSudokuSolver:
    """Combines CNN detection with AC-3 solving"""
    
    def __init__(self, model_path, timeout_seconds=30):
        """
        Initialize the solver
        
        Args:
            model_path: Path to trained CNN model (.keras file)
        """
        self.model_path = model_path
        self.timeout_seconds = timeout_seconds
        self.model = None
        self.nodes = 0
        self.backtracks = 0
        
    def load_model(self):
        """Load the CNN model"""
        print(f"\n[1/5] Loading CNN model from: {self.model_path}")
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        self.model = tf.keras.models.load_model(self.model_path)
        print("Model loaded successfully")
        
    def detect_and_recognize(self, image_path):
        """
        Detect Sudoku grid and recognize digits using CNN
        
        Args:
            image_path: Path to Sudoku image
            
        Returns:
            tuple: (grid_array, original_image, board_image)
                - grid_array: 9x9 numpy array of detected digits
                - original_image: Original input image
                - board_image: Warped grid image
        """
        print(f"\n[2/5] Processing image: {image_path}")
        
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
            
        # Load and preprocess image
        img = cv2.imread(image_path)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = sutils.resize_and_maintain_aspect_ratio(input_image=img, new_width=1000)
        print(f"  Image size: {img.shape[1]}x{img.shape[0]}")
        
        # Detect grid cells
        print("Detecting grid cells...")
        cells, M, board_image = sutils.get_valid_cells_from_image(img)
        print(f"Found {len(cells)} cells")
        
        # Recognize digits
        print("Recognizing digits with CNN")
        grid_array = sutils.get_predicted_sudoku_grid(self.model, cells)
        
        # Count recognized digits
        num_filled = np.count_nonzero(grid_array)
        print(f"Recognized {num_filled} digits")
        
        return grid_array, img, board_image
        
    def grid_to_string(self, grid_array):
        """Convert 9x9 grid to 81-character string"""
        return "".join(str(x) for x in grid_array.flatten())
        
    def solve_with_ac3(self, puzzle_string):
        """
        Solve puzzle using AC-3 + Backtracking
        
        Args:
            puzzle_string: 81-character string (0 for empty cells)
            
        Returns:
            tuple: (solution_string, runtime, memory_mb, success)
        """
        print("\n[3/5] Solving with AC-3 + Backtracking algorithm")
        
        if len(puzzle_string) != 81:
            raise ValueError(f"Puzzle must be 81 characters, got {len(puzzle_string)}")
        
        # Reset metrics
        self.nodes = 0
        self.backtracks = 0
        
        # Start tracking
        tracemalloc.start()
        start_time = time.perf_counter()
        
        success = False
        solution = None
        
        try:
            # Create Sudoku object
            sudoku = Sudoku(puzzle_string)
            
            # Phase 1: AC-3
            print("  [Phase 1] Running AC-3 constraint propagation...")
            ac3_result = AC3(sudoku)
            
            if not ac3_result:
                print(" AC-3 determined no solution exists")
                success = False
            elif sudoku.isFinished():
                print("AC-3 alone solved the puzzle!")
                success = True
            else:
                # Phase 2: Backtracking
                print("[Phase 2] AC-3 reduced search space. Starting backtracking...")
                
                assignment = {}
                for cell in sudoku.cells:
                    if len(sudoku.possibilities[cell]) == 1:
                        assignment[cell] = sudoku.possibilities[cell][0]
                
                result = self._tracked_backtrack(assignment, sudoku)
                
                if result:
                    for cell in sudoku.possibilities:
                        if cell in result:
                            sudoku.possibilities[cell] = [result[cell]]
                    success = True
                else:
                    success = False
            
            # Get solution string if successful
            if success:
                solution = self._sudoku_to_string(sudoku)
                
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            success = False
            
        # Stop tracking
        end_time = time.perf_counter()
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        runtime = end_time - start_time
        peak_mb = peak / (1024 * 1024)
        
        if success:
            print(f"Solved in {runtime:.4f}s")
            print(f"Nodes visited: {self.nodes}")
            print(f"Backtracks: {self.backtracks}")
            print(f"Memory used: {peak_mb:.2f} MB")
        else:
            print(f"Failed after {runtime:.4f}s")
            
        return solution, runtime, peak_mb, success
        
    def _tracked_backtrack(self, assignment, sudoku):
        """Backtracking with metrics tracking"""
        self.nodes += 1
        
        if len(assignment) == len(sudoku.cells):
            return assignment
        
        cell = select_unassigned_variable(assignment, sudoku)
        
        for value in order_domain_values(sudoku, cell):
            if is_consistent(sudoku, assignment, cell, value):
                assign(sudoku, cell, value, assignment)
                result = self._tracked_backtrack(assignment, sudoku)
                
                if result:
                    return result
                
                unassign(sudoku, cell, assignment)
                self.backtracks += 1
        
        return False
        
    def _sudoku_to_string(self, sudoku):
        """Convert Sudoku object to 81-character string"""
        result = []
        for cell in sudoku.cells:
            if len(sudoku.possibilities[cell]) == 1:
                result.append(str(sudoku.possibilities[cell][0]))
            else:
                result.append('0')
        return ''.join(result)
        
    def visualize_results(self, original_img, detected_grid, solved_grid):
        """Display original image, detected grid, and solution"""
        print("\n[4/5] Visualizing results")
        
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        
        # Original image
        axes[0].imshow(original_img)
        axes[0].set_title("Original Image", fontsize=14, fontweight='bold')
        axes[0].axis('off')
        
        # Detected grid
        axes[1].text(0.5, 1.05, "Detected Grid (CNN)", 
                     ha='center', transform=axes[1].transAxes,
                     fontsize=14, fontweight='bold')
        self._draw_grid(axes[1], detected_grid, "Detected")
        
        # Solved grid
        if solved_grid is not None:
            axes[2].text(0.5, 1.05, "Solved Grid (AC-3 + Backtracking)", 
                         ha='center', transform=axes[2].transAxes,
                         fontsize=14, fontweight='bold')
            self._draw_grid(axes[2], solved_grid, "Solved")
        else:
            axes[2].text(0.5, 0.5, "Solution Not Found", 
                        ha='center', va='center',
                        transform=axes[2].transAxes,
                        fontsize=16, color='red')
            axes[2].axis('off')
        
        plt.tight_layout()
        plt.show()
        
    def _draw_grid(self, ax, grid, title):
        """Draw a Sudoku grid on matplotlib axes"""
        if isinstance(grid, str):
            grid = np.array([int(c) for c in grid]).reshape(9, 9)
        
        # Create grid background
        ax.set_xlim(0, 9)
        ax.set_ylim(0, 9)
        ax.set_aspect('equal')
        ax.invert_yaxis()
        
        # Draw grid lines
        for i in range(10):
            linewidth = 2 if i % 3 == 0 else 0.5
            ax.axhline(i, color='black', linewidth=linewidth)
            ax.axvline(i, color='black', linewidth=linewidth)
        
        # Draw numbers
        for i in range(9):
            for j in range(9):
                num = grid[i][j]
                if num != 0:
                    color = 'blue' if title == "Detected" else 'green'
                    ax.text(j + 0.5, i + 0.5, str(num),
                           ha='center', va='center',
                           fontsize=14, fontweight='bold',
                           color=color)
        
        ax.set_xticks([])
        ax.set_yticks([])
        
    def print_grid(self, grid, title="Sudoku Grid"):
        """Print grid in console"""
        if isinstance(grid, str):
            grid = np.array([int(c) for c in grid]).reshape(9, 9)
            
        print(f"\n{title}:")
        print("=" * 25)
        for i in range(9):
            row = []
            for j in range(9):
                val = str(grid[i][j]) if grid[i][j] != 0 else '.'
                row.append(val)
            
            print(" ".join(row[0:3]) + " | " + 
                  " ".join(row[3:6]) + " | " + 
                  " ".join(row[6:9]))
            
            if i in [2, 5]:
                print("-" * 25)
        print()
        
    def solve_from_image(self, image_path, show_visualization=True):
        """
        Complete program: detect, recognize, and solve
        
        Args:
            image_path: Path to Sudoku image
            show_visualization: Whether to display matplotlib visualization
            
        Returns:
            dict: Results including grids, metrics, and success status
        """
        print("\n" + "=" * 70)
        print("INTEGRATED SUDOKU SOLVER")
        print("CNN Detection → AC-3 + Backtracking Algorithm")
        print("=" * 70)
        
        # Load model
        if self.model is None:
            self.load_model()
        
        # Detect and recognize
        detected_grid, original_img, board_img = self.detect_and_recognize(image_path)
        puzzle_string = self.grid_to_string(detected_grid)
        
        # Print detected grid
        self.print_grid(detected_grid, "Detected Sudoku Puzzle")
        
        # Solve
        solution_string, runtime, memory_mb, success = self.solve_with_ac3(puzzle_string)
        
        # Prepare results
        results = {
            'detected_grid': detected_grid,
            'puzzle_string': puzzle_string,
            'solution_string': solution_string,
            'solved_grid': None,
            'success': success,
            'runtime': runtime,
            'memory_mb': memory_mb,
            'nodes': self.nodes,
            'backtracks': self.backtracks,
            'original_image': original_img
        }
        
        if success:
            solved_grid = np.array([int(c) for c in solution_string]).reshape(9, 9)
            results['solved_grid'] = solved_grid
            self.print_grid(solved_grid, "Solved Sudoku Puzzle")
        
        # Visualize
        print("\n[5/5] Displaying results")
        if show_visualization:
            self.visualize_results(original_img, detected_grid, 
                                  results['solved_grid'] if success else None)
        
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"Status: {'SOLVED' if success else 'FAILED'}")
        print(f"Runtime: {runtime:.4f}s")
        print(f"Memory: {memory_mb:.2f} MB")
        print(f"Nodes visited: {self.nodes}")
        print(f"Backtracks: {self.backtracks}")
        print("=" * 70 + "\n")
        
        return results


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(
        description='Integrated Sudoku Solver: CNN Detection + AC-3 Algorithm',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sudoku_integrated_solver.py --image data/sudoku_images/puzzle1.jpg
  python sudoku_integrated_solver.py --image puzzle.jpg --model custom_model.keras
  python sudoku_integrated_solver.py --image puzzle.jpg --no-viz
        """
    )
    
    parser.add_argument(
        '--image',
        type=str,
        required=True,
        help='Path to Sudoku image file'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        default='CNN/cv-sudoku-solver/models/model_fonts_mnist.keras',
        help='Path to trained CNN model (default: CNN/cv-sudoku-solver/models/model_fonts_mnist.keras)'
    )
    
    parser.add_argument(
        '--no-viz',
        action='store_true',
        help='Disable matplotlib visualization'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='Timeout in seconds for solving (default: 30)'
    )
    
    args = parser.parse_args()
    
    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    model_path = script_dir / args.model
    
    try:
        # Create solver
        solver = IntegratedSudokuSolver(
            model_path=str(model_path),
            timeout_seconds=args.timeout
        )
        
        # Solve
        results = solver.solve_from_image(
            image_path=args.image,
            show_visualization=not args.no_viz
        )
        
        # Exit code
        sys.exit(0 if results['success'] else 1)
        
    except FileNotFoundError as e:
        print(f"\nError: {str(e)}")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
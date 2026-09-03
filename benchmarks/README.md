# benchmarks/

Extra puzzle sets for stressing the solvers, in the same format as the
`Algo*/{easy,medium,hard}.txt` files: one puzzle per line, 81 characters,
`0` = blank. No comments or blank lines (the readers strip every non-digit
character and re-chunk into groups of 81).

## hard.txt — 12 known-difficult puzzles

Each is a legal Sudoku with exactly one solution (verified with an
MRV-ordered solution counter). Ten of the twelve are 17-clue minimals.
These are the puzzles used across the literature to expose worst-case
behaviour in naive backtracking.

| line | puzzle | clues |
|---|---|---|
| 1 | AI Escargot (Arto Inkala, 2006) | 23 |
| 2 | Inkala 2010 / "Sudoku17 #1" | 17 |
| 3 | Inkala 2012 ("Everest" / "world's hardest") | 21 |
| 4 | Platinum Blonde | 21 |
| 5 | Golden Nugget | 21 |
| 6 | coly013 (high explanation-rating puzzle) | 17 |
| 7 | Fata Morgana / "Norvig hardest" | 17 |
| 8 | Kolk 17 | 17 |
| 9 | Sudoku17 #6 | 17 |
| 10 | Sudoku17 #12 | 17 |
| 11 | "Norvig hard" | 17 |
| 12 | top1465 #1 | 25 |

## Running

```
cd Algo1 && python3 algo1_run.py ../benchmarks/hard.txt
cd Algo2 && python3 algo2_run.py ../benchmarks/hard.txt
cd Algo3 && python3 algo3_run.py ../benchmarks/hard.txt
cd Algo4 && python3 algo4_run.py ../benchmarks/hard.txt
```

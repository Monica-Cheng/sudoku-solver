import type { AlgorithmName } from "@sudoku/solver-core";

export interface AlgoMeta {
  id: AlgorithmName;
  label: string;
  short: string;
  /** the event types this algorithm emits, for the sidebar caption */
  emits: string;
  /** one line for cards and chips */
  tagline: string;
  /** the shared complexity frame — how this algorithm relates to O(b^d) search */
  frame: string;
  /** plain-language explanation, three short paragraphs, no undefined jargon */
  explainer: string[];
  /** what the animation shows, tied to the actual events */
  onScreen: string;
  /** measured, with numbers from /benchmarks */
  strengths: string;
  weaknesses: string;
  /** when it wins, when it loses, and why */
  verdict: string;
}

export const ALGOS: AlgoMeta[] = [
  {
    id: "backtracking",
    label: "Backtracking",
    short: "BT",
    emits: "assign · unassign",
    tagline: "Guess a digit, recurse, undo on a dead end. No look-ahead.",
    frame:
      "A naive backtracking search is O(b^d): d levels deep — one per empty cell — and at each level up to b digits to try, the branching factor. Nothing here shrinks either number: b is the full set of candidates, d is every blank on the board. The worst case is the entire exponential tree. The other three algorithms are all ways to cut b, cut d, or both.",
    explainer: [
      "Backtracking is the textbook brute-force method: a depth-first search that tries digits one cell at a time. Take the first empty cell, put in the smallest digit that doesn't already clash with a filled neighbour in the same row, column, or 3×3 box, and move to the next empty cell. If you reach a cell where no digit fits, the last guess was wrong — erase it, go back, and try the next digit there. Repeat until the grid is full.",
      "The thing to notice is what it doesn't do. It never looks ahead. After placing a 5, it doesn't check whether that 5 has just left some other cell with no legal options — it only finds out later, when it crashes into that cell and has to unwind. It keeps no per-cell notes about what's still possible. Every decision is made from the raw board.",
      "That makes it simple and, on gentle puzzles, perfectly fast. But on a hard puzzle it has nothing to steer with. It will happily explore a branch hundreds of thousands of guesses deep before the contradiction that kills it surfaces. It is the baseline the other three are measured against.",
    ],
    onScreen:
      "Only two things happen: a cell lights up as a digit is placed (assign), or a cell clears with a red flash as a guess is taken back (unassign). No candidate marks, no dimming, no propagation — the grid just fills and empties. When the backtrack flashes come in fast bursts, that is the search thrashing inside a doomed branch.",
    strengths:
      "Trivial to implement and low overhead per step. On the easy and medium sets it solves every puzzle, median 2,025 and 786 search nodes. When a puzzle has enough clues to keep branches short, it is genuinely quick — low single-digit milliseconds.",
    weaknesses:
      "No pruning means no protection against a bad branch. Worst case on the easy set alone is 254,857 nodes — one puzzle where the digit order happened to be adversarial. On the extreme set it exhausts a 1.4-million-node budget on half the puzzles — it clears 6 of 12, and every one it fails is a 17-clue minimum.",
    verdict:
      "Wins on well-constrained puzzles where its lack of bookkeeping is pure speed. Loses the moment the puzzle is sparse enough that a wrong early guess hides a contradiction thousands of levels down — it cannot see that coming, so it pays the full price every time.",
  },
  {
    id: "forward_checking",
    label: "Forward checking + MRV",
    short: "FC",
    emits: "assign · unassign · eliminate · restore",
    tagline: "Track each cell's remaining options; always branch on the most constrained.",
    frame:
      "Same O(b^d) frame — b digits tried per cell, d cells deep. Forward checking attacks b: removing a placed digit from its peers' candidate lists shrinks the branching factor at every level below it. MRV attacks d: it always branches on the cell with the fewest candidates left. That is the \"fail-first\" heuristic — if a choice is going to fail, force the failure near the top of the tree, where one wrong turn is cheap to undo, rather than forty cells deep.",
    explainer: [
      "Forward checking adds one piece of bookkeeping to backtracking: for every empty cell it keeps a list of digits still legal there — the cell's candidates. Each time it places a digit, it immediately removes that digit from the candidate lists of every cell in the same row, column, and box. If any cell's list becomes empty, the current path is already dead, so it backtracks now instead of discovering the problem ten guesses later.",
      "The second idea is which cell to try next. Instead of the first empty cell, it picks the one with the fewest candidates left — the \"minimum remaining values\" or MRV rule. If some cell is down to a single candidate, fill that; if the fewest anywhere is two, you have a coin-flip instead of a nine-way guess. This is \"fail-first\" thinking: take the hardest decision while the tree above it is still small, so a wrong guess costs one cheap undo instead of unwinding a deep branch.",
      "Together these turn the search from blind to sighted. It still guesses and still backtracks, but it almost never wanders far, because a bad guess usually empties some candidate list within a move or two and gets rejected.",
    ],
    onScreen:
      "Alongside the assign and unassign of plain backtracking you see candidate digits dim inside cells (eliminate) as each placement prunes its neighbours, and light back up (restore) when a guess is undone. The next cell chosen is always one of the sparsest — watch the search jump to wherever the fewest candidates remain rather than moving left to right.",
    strengths:
      "The MRV rule flattens difficulty. Median search is 56, 59, and 63 nodes on easy, medium, and hard — essentially the same tiny number regardless of tier. It solves all 90 puzzles in those three sets and all 12 in the extreme set. Fastest of the four in wall-clock terms on ordinary puzzles: about 0.14 ms in the TypeScript port.",
    weaknesses:
      "It only checks one step ahead. It can still walk into a trap where no single placement empties a list but the combination is already unsatisfiable — its one pathological hard-set puzzle took 149,731 nodes where AC-3 took just 68 on that same puzzle. On the extreme set its median is 9,903 nodes against AC-3's 7,310 — AC-3's deeper propagation starts to earn its keep.",
    verdict:
      "Wins on the vast majority of puzzles: same node count as AC-3 with far less overhead, because it does no upfront work. Loses on the rare puzzle whose contradictions are two or more moves deep — there, the heavier propagation AC-3 does before searching would have paid off.",
  },
  {
    id: "ac3",
    label: "AC-3 + backtracking",
    short: "AC3",
    emits: "ac3_revise · eliminate · restore · assign · unassign",
    tagline: "Propagate constraints to a fixed point first, then search what's left.",
    frame:
      "The same O(b^d) frame, and AC-3 attacks b hardest. Forward checking only prunes the peers of a digit it just placed; AC-3 keeps propagating — every elimination triggers re-checks of the arcs feeding into that cell — until nothing more can be removed. On many puzzles that drives b to 1 for every cell, which collapses d to zero: no search at all. The MRV/LCV ordering in whatever search remains is the fail-first idea again — surface a contradiction near the root, not deep in the tree.",
    explainer: [
      "AC-3 (the name is just its number in the paper that introduced it) enforces a property called arc consistency before any guessing happens. An \"arc\" is an ordered pair of cells that share a row, column, or box. A pair is consistent when, for every candidate digit in the first cell, the second cell has some candidate that doesn't conflict. If a digit in the first cell has no such partner, it can never be used, so it is removed.",
      "Removing a candidate can break consistency for other arcs that were fine a moment ago, so AC-3 keeps a queue: revise an arc, and if it changed anything, re-add every arc pointing back into that cell. It runs until the queue empties and nothing more can be removed. For many puzzles this alone collapses every cell to a single candidate — the puzzle falls out with no search at all.",
      "Whatever arc consistency can't finish is handed to a backtracking search with the same MRV cell-ordering as forward checking, now working on the already-shrunken candidate lists.",
    ],
    onScreen:
      "During the opening propagation you see pairs of cells pulse (ac3_revise) as each arc is checked, with candidates dimming (eliminate) all over the grid. This phase can run for a while before a single digit is committed. Once it settles, the search begins and looks just like forward checking — assign, eliminate, the occasional unassign and restore.",
    strengths:
      "The tightest worst cases of the four. On the hard set its worst puzzle is 1,235 nodes versus forward checking's 149,731; on easy, 384 versus backtracking's 254,857. It solves all 90 easy/medium/hard puzzles and all 12 extreme puzzles, with the lowest median node count on the extreme set (7,310).",
    weaknesses:
      "The propagation is not free. Every solve pays for the full arc-consistency pass whether or not it was needed, which is why AC-3 is the slowest of the deterministic three on easy puzzles — roughly 1.6 ms against forward checking's 0.14 ms in TypeScript, despite the two exploring a near-identical number of nodes.",
    verdict:
      "Wins when a puzzle is hard enough that propagation prevents a blow-up the one-step check would have missed — its bounded worst case is the whole point. Loses on easy puzzles, where it does a lot of upfront work to reach the same answer forward checking gets to immediately.",
  },
  {
    id: "min_conflicts",
    label: "Min-conflicts",
    short: "MC",
    emits: "conflicts · swap · reassign",
    tagline: "Start from a full random grid; repair the worst cell, over and over.",
    frame:
      "The other three live inside the O(b^d) search tree and try to shrink b and d. Min-conflicts has no tree — no branching factor, no depth. It holds one complete grid and edits it toward fewer conflicts, like walking downhill on a landscape whose height is the conflict count. That trades the exponential worst case for a different failure: the walk reaching a spot it can't leave. It pays off where solutions are dense and the landscape is smooth — N-Queens is the classic fit — and works against you where constraints are tight and the landscape is jagged, which is Sudoku.",
    explainer: [
      "Min-conflicts is a local search, which means it never builds a solution piece by piece — it starts with a complete, wrong grid and tries to fix it. Each row is filled with a random permutation that already contains the digits 1–9 exactly once, so rows are never in conflict; all the errors live in the columns and boxes. The givens are locked in place.",
      "Each iteration: pick a cell that is currently in conflict, look at every other non-given cell in its row, and swap the pair if doing so lowers the total number of conflicts across the grid. Keep the best swap. If nothing helps, reset the cell to a random low-conflict value and count that as a restart. A counter tracks total conflicts; the search stops when it hits zero.",
      "This is a completely different strategy from the other three. There is no tree, no backtracking, no notion of a partial solution — just a full grid getting less wrong, most of the time. It is the approach that scales to problems far larger than Sudoku, which is why it is worth showing even though it is the wrong tool here.",
    ],
    onScreen:
      "No cell ever empties. You see two values inside a row trade places (swap) and a conflict count that drops fast at first, then slows, then sticks. A flat line above zero is one of three traps: a local minimum, where every available swap makes things worse; a plateau, where swaps neither help nor hurt and the walk wanders without progress; or a ridge, where progress needs two coordinated swaps and the search only ever makes one. It cannot tell which it is in, or climb out of any of them.",
    strengths:
      "On problems with a wide margin of freedom — many solutions, loose constraints — it converges fast with no search tree and a flat memory footprint. It clears the hard set at a median of 847 iterations, and the technique scales to constraint problems with millions of variables.",
    weaknesses:
      "Incomplete: it can get permanently stuck, and on Sudoku it often does. It times out on 5–7 of every 90 attempts across the easy, medium, and hard sets even with three random starts each, and on the extreme set it solves just 4 of 36. That isn't about clue count — it's that tight constraints make the conflict landscape almost all local minima, plateaus, and ridges.",
    verdict:
      "Wins on loosely constrained problems where solutions are dense and a systematic search would run out of memory — the textbook case is N-Queens, where min-conflicts places a million queens in seconds. Sudoku is the opposite: tightly constrained, very few solutions, a landscape full of traps. Our numbers show the split — 253 of 270 easy/medium/hard attempts solved (94%), but only 4 of 36 on the extreme set (seven of its twelve puzzles are 17-clue minimums). It's the constraint tightness that breaks it, not the number of givens.",
  },
];

export const ALGO_BY_ID: Record<AlgorithmName, AlgoMeta> = Object.fromEntries(
  ALGOS.map((a) => [a.id, a]),
) as Record<AlgorithmName, AlgoMeta>;

/**
 * "Failure explained" — shown when a run gives up. States the cap that was hit
 * and why this puzzle defeats this technique in particular.
 */
export function failureText(
  algo: AlgorithmName,
  opts: { clues: number; nodes: number; cap: number },
): string {
  const { clues, nodes, cap } = opts;
  const capStr = cap.toLocaleString("en-US");
  const nodeStr = nodes.toLocaleString("en-US");
  const emptyCells = 81 - clues;
  switch (algo) {
    case "backtracking":
      return `Stopped after ${nodeStr} search nodes, at the ${capStr}-node cap. Backtracking has no pruning: it commits to a digit, recurses, and only finds out a choice was wrong when the search later reaches a cell with no legal value. The number of arrangements it may have to try grows exponentially with the number of empty cells (${emptyCells} here), and the cap arrived before it could exhaust them. Forward checking or AC-3 prune the same puzzle to roughly ten thousand nodes.`;
    case "forward_checking":
      return `Stopped after ${nodeStr} nodes, at the ${capStr}-node cap — unusual for this algorithm. Forward checking only tests one move ahead, so it can still descend into a branch where no single placement empties a candidate list but the combination is already unsatisfiable. This is the rare puzzle shaped to exploit exactly that blind spot; AC-3's fixed-point propagation would catch it earlier.`;
    case "ac3":
      return `Stopped after ${nodeStr} nodes, at the ${capStr}-node cap — rare for AC-3. Arc consistency pruned the domains but couldn't reduce every cell to a single value, and the MRV/LCV search that followed still didn't close the puzzle within the budget. A grid that resists both needs a stronger form of inference than arc-consistency — reasoning over pairs isn't enough here — and this solver doesn't implement one.`;
    case "min_conflicts":
      return `Gave up after ${nodeStr} iterations at the ${capStr}-iteration cap, with conflicts still above zero. Min-conflicts is local search: it swaps values within a row to lower the total conflict count and only succeeds if that count reaches zero. With no backtracking and no memory it can't climb out of a local minimum — a state where no single swap helps. It also can't tell a stuck search from an impossible one: if the grid is contradictory there is no conflict-free arrangement to reach, so it runs to the cap regardless. Neither failure depends on how many clues the puzzle has.`;
  }
}

/**
 * Step / node budget for one algorithm on one puzzle.
 *
 * The three complete searches (backtracking, forward-checking, AC-3) get a
 * cap that scales with how sparse the puzzle looks — a 17-clue puzzle needs
 * far more nodes to exhaust than a 30-clue one, so the live page gives it a
 * bigger budget the same way benchmarks/run_solver_bench.py does.
 *
 * min-conflicts always gets a flat 200,000 — its own DEFAULT_MAX_STEPS
 * (solvers/min_conflicts/core.py, src/solvers/minConflicts.ts) and the same
 * cap used for every tier on /benchmarks. It does NOT scale with clue count:
 * scaling it up the way the complete searches are scaled would let it solve
 * far more often live than the published "4 of 36 on the extreme set"
 * describes, for the same puzzles.
 */
export function budgetFor(
  puzzle: string,
  algo: AlgorithmName,
): { maxSteps: number; maxEvents: number } {
  const clues = 81 - (puzzle.match(/0/g)?.length ?? 0);
  const maxEvents = clues <= 20 ? 6000 : clues <= 25 ? 5000 : 4000;
  if (algo === "min_conflicts") return { maxSteps: 200_000, maxEvents };
  if (clues <= 20) return { maxSteps: 1_400_000, maxEvents };
  if (clues <= 25) return { maxSteps: 500_000, maxEvents };
  return { maxSteps: 200_000, maxEvents };
}

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
      "Backtracking is the simplest way to solve a Sudoku: pick the first empty cell, try digit 1, move to the next empty cell, and keep going. If you reach a cell where no digit fits, go back to the last guess and try the next option.",
      "The problem is that it does not think ahead. It just tries things, and only finds out a guess was wrong when it crashes into a dead end much later. On easy puzzles this is fine — it solves all 30, using a median of 2,025 guesses. But on hard puzzles it can go down a dead-end branch for hundreds of thousands of guesses before catching the mistake. It times out on 2 of 30 hard puzzles and 6 of 12 extreme puzzles under a 1.4 million guess cap.",
      "It is the baseline the other three are measured against — every improvement in forward checking, AC-3, and min-conflicts is measured by how much better it does than this.",
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
      "Forward checking adds one piece of bookkeeping to backtracking: for each empty cell, it keeps a list of digits still allowed there. Every time it places a digit, it immediately crosses that digit off the list for every related cell in the same row, column, and box. If any cell's list goes empty, it knows the current path is already broken and backtracks right now, instead of finding out much later.",
      "MRV (Minimum Remaining Values) decides which cell to fill next. Instead of going left to right, it always picks the cell with the fewest options left. If one cell is down to a single digit, fill that first — no guessing needed. This keeps the search from wandering.",
      "The effect is dramatic. Where backtracking uses a median of 2,025 guesses on easy puzzles, forward checking uses 56. It solves all 90 easy, medium, and hard puzzles, and all 12 extreme puzzles. Its one weakness: it only looks one step ahead. On one hard puzzle it still took 149,731 guesses, while AC-3 solved the same puzzle in just 68.",
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
      "AC-3 does a more thorough cleanup before guessing anything. It looks at every pair of cells that share a row, column, or box, and asks: for each digit still allowed in cell A, is there at least one digit still allowed in cell B that does not conflict? If not, that digit can never work in cell A, so it gets removed.",
      "Removing a digit from one cell can affect other pairs, so it repeats the check for those too. It keeps going until nothing more can be removed. On many puzzles this alone is enough to fill every cell with no guessing at all.",
      "This makes AC-3 the strongest on tough puzzles. Its worst case on the hard set is 1,235 guesses, compared to forward checking's 149,731. It solves all 90 easy, medium, and hard puzzles and all 12 extreme puzzles. The tradeoff is that the upfront cleanup takes time even on easy puzzles where forward checking would have just solved it immediately, which is why AC-3 is slower on easy puzzles despite making a similar number of guesses.",
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
      "The other three algorithms build a solution step by step from an empty grid. Min-conflicts does the opposite: it starts with a completely filled grid that is probably wrong, and tries to fix the errors.",
      "Each row is filled with a random shuffle of 1–9, so rows are never in conflict. All the mistakes live in the columns and boxes. Each step picks a cell that is causing a conflict, finds the swap within its row that reduces the total number of conflicts most, and makes that swap. It repeats until the conflict count reaches zero, or it runs out of attempts (capped at 200,000 iterations).",
      "On typical puzzles this works well — it clears 85 of 90 easy, medium, and hard attempts (94%). But Sudoku has very tight constraints, and the conflict landscape is full of traps: states where every possible swap makes things slightly worse. Min-conflicts has no way to climb out. On the 12 extreme puzzles it solves only 4 of 36 attempts. It is the most interesting algorithm to watch precisely because it behaves so differently from the other three.",
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

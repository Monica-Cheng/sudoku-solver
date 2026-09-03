import type { AlgorithmName } from "@sudoku/solver-core";

export interface AlgoMeta {
  id: AlgorithmName;
  label: string;
  short: string;
  /** placeholder explainer — the real per-algorithm essays land next phase */
  blurb: string;
  emits: string;
}

export const ALGOS: AlgoMeta[] = [
  {
    id: "backtracking",
    label: "Backtracking",
    short: "BT",
    blurb:
      "Fill the first blank cell with the first digit that isn't already used by a peer, recurse, and undo on a dead end. No domains, no propagation — it only ever assigns and unassigns. On a hard puzzle it has nothing to prune with, so it guesses blind.",
    emits: "assign · unassign",
  },
  {
    id: "forward_checking",
    label: "Forward checking + MRV",
    short: "FC",
    blurb:
      "Keep a set of remaining candidates per cell. Always branch on the cell with the fewest left (MRV). After each assignment, remove that value from every peer's candidate set; if any set empties, backtrack.",
    emits: "assign · unassign · eliminate · restore",
  },
  {
    id: "ac3",
    label: "AC-3 + backtracking",
    short: "AC3",
    blurb:
      "Before searching, enforce arc-consistency: for every ordered pair of peer cells, drop values from one that no value of the other allows. Often this alone solves the puzzle. Whatever's left goes to an MRV/LCV backtracking search.",
    emits: "ac3_revise · eliminate · assign · unassign · restore",
  },
  {
    id: "min_conflicts",
    label: "Min-conflicts",
    short: "MC",
    blurb:
      "Local search: start from a random full grid (each row a permutation), then repeatedly pick a conflicted cell and swap within its row to reduce total conflicts. Incomplete — on a sparse puzzle it thrashes in local minima and gives up.",
    emits: "swap · reassign · conflicts",
  },
];

export const ALGO_BY_ID: Record<AlgorithmName, AlgoMeta> = Object.fromEntries(
  ALGOS.map((a) => [a.id, a]),
) as Record<AlgorithmName, AlgoMeta>;

/** step / node budget by whether the puzzle looks hard */
export function budgetFor(puzzle: string): { maxSteps: number; maxEvents: number } {
  const clues = 81 - (puzzle.match(/0/g)?.length ?? 0);
  if (clues <= 20) return { maxSteps: 1_400_000, maxEvents: 6000 };
  if (clues <= 25) return { maxSteps: 500_000, maxEvents: 5000 };
  return { maxSteps: 200_000, maxEvents: 4000 };
}

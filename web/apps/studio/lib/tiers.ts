/**
 * Difficulty tiers. `bench-hard` is the internal id kept from the puzzle
 * library generator; everywhere a person sees it, it reads "extreme".
 */
export const TIER_IDS = ["easy", "medium", "hard", "bench-hard"] as const;
export type TierId = (typeof TIER_IDS)[number];

export const TIER_LABEL: Record<TierId, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  "bench-hard": "extreme",
};

/** longer gloss, used on the benchmark page and the library help text */
export const TIER_BLURB: Record<TierId, string> = {
  easy: "30 puzzles, 22–41 clues — solvable by scanning.",
  medium: "30 puzzles, 24–26 clues — need some pencil-marking.",
  hard: "30 puzzles, 14–28 clues — real branching required.",
  "bench-hard":
    "The hardest puzzles in the literature: AI Escargot, Platinum Blonde, Golden Nugget, seven 17-clue minimums. Naive backtracking flails here; AC-3 barely blinks.",
};

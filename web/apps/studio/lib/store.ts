"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecognitionResult } from "./types";

interface AppState {
  /** the puzzle the user is working with (81 chars) */
  puzzle: string | null;
  /** set only when the puzzle came from an image upload */
  recognition: RecognitionResult | null;
  setPuzzle: (p: string, recognition?: RecognitionResult | null) => void;
  clear: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      puzzle: null,
      recognition: null,
      setPuzzle: (puzzle, recognition = null) => set({ puzzle, recognition }),
      clear: () => set({ puzzle: null, recognition: null }),
    }),
    {
      name: "sudoku-studio",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? undefinedStorage : window.sessionStorage,
      ),
    },
  ),
);

const undefinedStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

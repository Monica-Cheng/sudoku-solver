export interface RecognitionResult {
  grid: string; // 81 chars, "0" = blank
  confidences: number[]; // per cell, 0 for blanks
  lowConfidenceCells: number[];
  gridDetected: boolean;
  error: string | null;
  legalityViolations?: number[];
}

export type Mode = "single" | "race";

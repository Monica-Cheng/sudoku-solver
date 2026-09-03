import type { RecognitionResult } from "./types";

const ENDPOINT =
  process.env.NEXT_PUBLIC_INFERENCE_API ?? "http://localhost:8000/api";

const BLANK: RecognitionResult = {
  grid: "0".repeat(81),
  confidences: new Array(81).fill(0),
  lowConfidenceCells: [],
  gridDetected: false,
  error: null,
};

/** POST an image file to the inference endpoint. gridDetected:false is a
 *  normal outcome, not a thrown error — only network/parse failures throw. */
export async function recognizeImage(file: File): Promise<RecognitionResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ...BLANK,
      error: `inference API returned ${res.status} with a non-JSON body`,
    };
  }

  const r = data as Partial<RecognitionResult>;
  if (typeof r.grid !== "string" || typeof r.gridDetected !== "boolean") {
    return { ...BLANK, error: "inference API returned an unexpected shape" };
  }
  return {
    grid: r.grid,
    confidences: r.confidences ?? new Array(81).fill(0),
    lowConfidenceCells: r.lowConfidenceCells ?? [],
    gridDetected: r.gridDetected,
    error: r.error ?? null,
    legalityViolations: r.legalityViolations ?? [],
  };
}

export const INFERENCE_ENDPOINT = ENDPOINT;

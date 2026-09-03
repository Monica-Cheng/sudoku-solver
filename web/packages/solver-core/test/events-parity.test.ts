/**
 * Event-stream parity: for a sample of puzzles across tiers, run the TS solver
 * unsampled and diff the full event list against the Python event stream
 * (web/test/fixtures/event_streams.json, produced by scratch/dump_events.py).
 *
 * Any divergence means the search took a different path, even if it reached the
 * same final result - so this is a stronger check than parity.test.ts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { solve, type SolverName, type StepEvent } from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const streams = JSON.parse(
  readFileSync(resolve(HERE, "fixtures/event_streams.json"), "utf8"),
) as Record<
  string,
  {
    puzzle: string;
    seed: number;
    max_steps: number;
    result: { solved: boolean; nodes: number; backtracks: number; terminated_reason: string };
    n_events: number;
    events: StepEvent[];
  }
>;

/** Stable key order so JSON.stringify comparison is order-insensitive per event. */
function canon(ev: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(ev)
      .sort()
      .reduce<Record<string, unknown>>((o, k) => ((o[k] = ev[k]), o), {}),
  );
}

describe("event-stream parity (Python vs TypeScript)", () => {
  for (const [key, expected] of Object.entries(streams)) {
    it(`${key} - ${expected.n_events} events`, () => {
      const [algo, ..._rest] = key.split("|") as [SolverName, string];
      const got: StepEvent[] = [];
      const r = solve(expected.puzzle, algo, {
        onStep: (e) => got.push(e),
        seed: expected.seed,
        maxSteps: expected.max_steps,
      });

      // result must match too
      expect({
        solved: r.solved,
        nodes: r.nodes,
        backtracks: r.backtracks,
        terminated_reason: r.terminatedReason,
      }).toEqual(expected.result);

      expect(got.length).toBe(expected.events.length);

      // first divergence, if any
      const n = Math.min(got.length, expected.events.length);
      for (let i = 0; i < n; i++) {
        const a = canon(got[i] as unknown as Record<string, unknown>);
        const b = canon(expected.events[i] as unknown as Record<string, unknown>);
        if (a !== b) {
          throw new Error(
            `first divergence at event ${i}/${n}:\n  py: ${b}\n  ts: ${a}\n` +
              `  prev py: ${i > 0 ? canon(expected.events[i - 1] as never) : "-"}`,
          );
        }
      }
    });
  }
});

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SolverClient } from "@sudoku/solver-core/worker";
import type {
  AlgorithmName,
  SolveResult,
  StepEvent,
} from "@sudoku/solver-core";

export type RunStatus = "idle" | "running" | "done" | "stopped" | "error";

interface StartOpts {
  puzzle: string;
  algorithm: AlgorithmName;
  seed?: number;
  maxSteps: number;
  maxEvents: number;
  onBatch: (events: StepEvent[]) => void;
  onSettled: (r: { status: RunStatus; result: SolveResult | null; message?: string }) => void;
}

function makeWorker(): Worker {
  return new Worker(new URL("../app/workers/solver.worker.ts", import.meta.url), {
    type: "module",
  });
}

/**
 * One solver Worker per hook instance, via the Phase 3 SolverClient (time-based
 * event batching + cooperative/hard cancel). Batches are handed straight to the
 * caller; nothing is rendered per event.
 */
export function useSolver() {
  const clientRef = useRef<SolverClient | null>(null);
  const runRef = useRef<ReturnType<SolverClient["run"]> | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");

  useEffect(() => {
    const client = new SolverClient(makeWorker, { graceMs: 120 });
    clientRef.current = client;
    return () => client.dispose();
  }, []);

  const start = useCallback((opts: StartOpts) => {
    const client = clientRef.current;
    if (!client) return;
    runRef.current?.cancel();
    setStatus("running");

    const run = client.run(
      opts.puzzle,
      opts.algorithm,
      {
        seed: opts.seed,
        maxSteps: opts.maxSteps,
        maxEvents: opts.maxEvents,
        flushMs: 16,
      },
      opts.onBatch,
    );
    runRef.current = run;

    run.result.then(
      (result) => {
        setStatus("done");
        opts.onSettled({
          status: result.terminatedReason === "solved" ? "done" : "stopped",
          result,
        });
      },
      (err: unknown) => {
        const cancelled = err instanceof Error && err.name === "CancelledError";
        setStatus(cancelled ? "stopped" : "error");
        // A cancelled run (algorithm switch / restart) is not an outcome the
        // caller needs — it already moved on to a fresh run. Only report a
        // genuine failure.
        if (cancelled) return;
        opts.onSettled({
          status: "error",
          result: null,
          message: err instanceof Error ? err.message : String(err),
        });
      },
    );
  }, []);

  const cancel = useCallback(() => {
    runRef.current?.cancel();
  }, []);

  return { start, cancel, status };
}

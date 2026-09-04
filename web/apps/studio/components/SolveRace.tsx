"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AlgorithmName, SolveResult, StepEvent } from "@sudoku/solver-core";
import { Board } from "@/components/Board";
import { fmtInt, fmtMs } from "@/components/Metrics";
import { GridModel } from "@/lib/gridState";
import { useSolver } from "@/lib/useSolver";
import { ALGOS, budgetFor } from "@/lib/algorithms";
import { outcomeFor, TONE_TEXT, type SettledRun } from "@/lib/outcomes";

const EVENTS_PER_FRAME = 900; // per grid

export function SolveRace({ puzzle }: { puzzle: string }) {
  const router = useRouter();
  const budget = budgetFor(puzzle);

  // one solver hook per algorithm (fixed order, unconditional)
  const s0 = useSolver();
  const s1 = useSolver();
  const s2 = useSolver();
  const s3 = useSolver();
  const solvers = [s0, s1, s2, s3];

  const modelsRef = useRef(ALGOS.map((a) => new GridModel(puzzle, a.id)));
  const buffersRef = useRef<StepEvent[][]>([[], [], [], []]);
  const settledRef = useRef<Array<null | { status: string; result: SolveResult | null; message?: string }>>(
    [null, null, null, null],
  );
  const startedAtRef = useRef(0);
  const [, render] = useReducer((x) => x + 1, 0);
  const [nonce, setNonce] = useState(0);
  const [tab, setTab] = useState(0); // mobile: which grid is visible

  useEffect(() => {
    modelsRef.current = ALGOS.map((a) => new GridModel(puzzle, a.id));
    buffersRef.current = [[], [], [], []];
    settledRef.current = [null, null, null, null];
    startedAtRef.current = performance.now();
    ALGOS.forEach((a, i) => {
      solvers[i].start({
        puzzle,
        algorithm: a.id,
        seed: 0,
        maxSteps: budget.maxSteps,
        maxEvents: budget.maxEvents,
        onBatch: (evs) => buffersRef.current[i].push(...evs),
        onSettled: (res) => {
          settledRef.current[i] = res;
          if (res.result) modelsRef.current[i].finalize(res.result);
        },
      });
    });
    return () => solvers.forEach((s) => s.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle, nonce]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      for (let i = 0; i < 4; i++) {
        const buf = buffersRef.current[i];
        if (buf.length) {
          const take = buf.splice(0, EVENTS_PER_FRAME);
          const m = modelsRef.current[i];
          for (const ev of take) m.apply(ev, now);
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const anyRunning = settledRef.current.some((s) => s === null);
  const elapsed = anyRunning
    ? performance.now() - startedAtRef.current
    : Math.max(...settledRef.current.map((s) => s?.result?.runtimeMs ?? 0));

  // teaching moment: a complete search can prove no solution exists; local
  // search (min-conflicts) can only fail to find one and run to its cap.
  const provedUnsolvable =
    !anyRunning &&
    ALGOS.some((a, i) => {
      if (a.id === "min_conflicts") return false;
      const reason = settledRef.current[i]?.result?.terminatedReason;
      return reason === "exhausted" || reason === "no_solution";
    });
  const mcIdx = ALGOS.findIndex((a) => a.id === "min_conflicts");
  const mcCapped =
    settledRef.current[mcIdx]?.result?.terminatedReason === "max_steps";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between num text-[12px] text-text-dim">
        <span>
          four algorithms · one puzzle ·{" "}
          <span className="text-text-faint">
            {81 - (puzzle.match(/0/g)?.length ?? 0)} clues
          </span>
        </span>
        <div className="flex items-center gap-3">
          <span className="text-text-faint">
            {anyRunning ? "running" : "done"} · {fmtMs(elapsed)}
          </span>
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="rounded border border-border px-2 py-1 hover:text-text"
          >
            restart
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-text-faint hover:text-text-dim"
          >
            ← new puzzle
          </button>
        </div>
      </div>

      {/* mobile tab bar */}
      <div className="flex gap-1 rounded border border-border bg-bg-raised p-1 num text-[11px] md:hidden">
        {ALGOS.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setTab(i)}
            className={`flex-1 rounded px-1 py-1.5 ${
              tab === i ? "bg-bg text-text" : "text-text-dim"
            }`}
          >
            {a.short}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {ALGOS.map((a, i) => (
          <RaceCell
            key={a.id}
            label={a.label}
            algo={a.id}
            puzzle={puzzle}
            model={modelsRef.current[i]}
            settled={settledRef.current[i]}
            hiddenOnMobile={tab !== i}
          />
        ))}
      </div>

      {provedUnsolvable && (
        <p className="rounded border border-border bg-bg-raised p-3 text-[12px] leading-relaxed text-text-dim">
          <span className="num text-text-dim">no solution exists.</span>{" "}
          {mcCapped ? (
            <>
              backtracking, forward-checking and AC-3 each explored the whole
              space and <em>proved</em> it. Min-conflicts can&rsquo;t: local
              search only ever reports &ldquo;didn&rsquo;t find one&rdquo;, so it
              runs to its {fmtInt(budget.maxSteps)}-iteration cap.
            </>
          ) : (
            <>
              the complete searches explored every possibility and found no valid
              completion — the givens contradict each other.
            </>
          )}
        </p>
      )}
    </div>
  );
}

function RaceCell({
  label,
  algo,
  puzzle,
  model,
  settled,
  hiddenOnMobile,
}: {
  label: string;
  algo: AlgorithmName;
  puzzle: string;
  model: GridModel;
  settled: SettledRun | null;
  hiddenOnMobile: boolean;
}) {
  const running = settled === null;
  const r = settled?.result ?? null;
  const outcome = outcomeFor(settled, { puzzle, algo });
  const statusLabel = running ? "running" : (outcome?.label ?? "—");
  const statusColor = running
    ? "text-text-dim"
    : outcome
      ? TONE_TEXT[outcome.tone]
      : "text-text-faint";

  return (
    <div
      className={`flex flex-col gap-2 rounded border border-border bg-bg-raised p-3 ${
        hiddenOnMobile ? "hidden md:flex" : "flex"
      }`}
    >
      <div className="flex items-center justify-between num text-[11px]">
        <span className="text-text">{label}</span>
        <span className={statusColor}>{statusLabel}</span>
      </div>

      <div className="mx-auto w-full max-w-[360px]">
        <Board model={model} tick={model.version} />
      </div>

      <div className="grid grid-cols-4 gap-2 num text-[10px]">
        <Counter label="step" value={fmtInt(model.step)} accent />
        <Counter label="nodes" value={fmtInt(model.nodes)} />
        <Counter label="backtracks" value={fmtInt(model.backtracks)} />
        <Counter
          label={model.conflicts !== null ? "conflicts" : "elapsed"}
          value={
            model.conflicts !== null
              ? fmtInt(model.conflicts)
              : r
                ? fmtMs(r.runtimeMs)
                : "—"
          }
        />
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-text-faint">
        {label}
      </span>
      <span className={accent ? "text-accent" : "text-text"}>{value}</span>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AlgorithmName, SolveResult, StepEvent } from "@sudoku/solver-core";
import { Board } from "@/components/Board";
import { Metric, fmtInt, fmtMs } from "@/components/Metrics";
import { GridModel } from "@/lib/gridState";
import { useSolver } from "@/lib/useSolver";
import { ALGOS, ALGO_BY_ID, budgetFor, failureText } from "@/lib/algorithms";
import { AlgoExplainer } from "@/components/AlgoExplainer";

interface Props {
  puzzle: string;
  initialAlgo: AlgorithmName;
}

const SPEEDS = [1, 5, 20, 80, 250, 800, 2500, 12000];

export function SolveSingle({ puzzle, initialAlgo }: Props) {
  const router = useRouter();
  const solver = useSolver();
  const [algo, setAlgo] = useState<AlgorithmName>(initialAlgo);
  const budget = budgetFor(puzzle);

  const modelRef = useRef(new GridModel(puzzle, algo));
  const eventsRef = useRef<StepEvent[]>([]);
  const appliedRef = useRef(0);
  const targetRef = useRef(0);
  const followRef = useRef(true);
  const settledRef = useRef<null | { status: string; result: SolveResult | null; message?: string }>(
    null,
  );
  const startedAtRef = useRef(0);

  const [playing, setPlaying] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(4);
  const [, render] = useReducer((x) => x + 1, 0);
  const [runNonce, setRunNonce] = useState(0);

  const beginRun = useCallback(
    (a: AlgorithmName) => {
      modelRef.current = new GridModel(puzzle, a);
      eventsRef.current = [];
      appliedRef.current = 0;
      targetRef.current = 0;
      followRef.current = true;
      settledRef.current = null;
      startedAtRef.current = performance.now();
      setPlaying(true);
      solver.start({
        puzzle,
        algorithm: a,
        seed: 0,
        maxSteps: budget.maxSteps,
        maxEvents: budget.maxEvents,
        onBatch: (evs) => {
          eventsRef.current.push(...evs);
        },
        onSettled: (s) => {
          settledRef.current = s;
          if (s.result) modelRef.current.finalize(s.result);
        },
      });
    },
    [puzzle, budget.maxSteps, budget.maxEvents, solver],
  );

  // (re)start whenever the algorithm changes
  useEffect(() => {
    beginRun(algo);
    return () => solver.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algo, runNonce]);

  // animation loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const total = eventsRef.current.length;
      const running = settledRef.current === null;
      if (playing) {
        if (followRef.current && running) {
          targetRef.current = total;
        } else {
          targetRef.current = Math.min(total, targetRef.current + SPEEDS[speedIdx]);
          if (targetRef.current >= total && running) followRef.current = true;
        }
      }
      if (targetRef.current > appliedRef.current) {
        const now = performance.now();
        const evs = eventsRef.current;
        for (let k = appliedRef.current; k < targetRef.current; k++) {
          modelRef.current.apply(evs[k], now);
        }
        appliedRef.current = targetRef.current;
      }
      render(); // every frame — one board, cheap; also decays flash/pulse
      if (
        playing &&
        !running &&
        appliedRef.current >= total &&
        total > 0
      ) {
        setPlaying(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedIdx]);

  const model = modelRef.current;
  const meta = ALGO_BY_ID[algo];
  const running = settledRef.current === null;
  const settled = settledRef.current;
  const elapsed = running
    ? performance.now() - startedAtRef.current
    : (settled?.result?.runtimeMs ?? 0);

  const stepShown = model.step;
  const stepDenom = settled?.result ? settled.result.nodes : budget.maxSteps;

  const stepForward = () => {
    followRef.current = false;
    setPlaying(false);
    targetRef.current = Math.min(eventsRef.current.length, targetRef.current + 1);
  };

  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* grid + playback */}
      <section className="flex flex-col items-center gap-4">
        <div className="w-full max-w-[600px]">
          <Board model={model} tick={model.version} />
        </div>

        <PlaybackBar
          playing={playing}
          onToggle={() => {
            if (!playing) followRef.current = false;
            setPlaying((p) => !p);
          }}
          onStep={stepForward}
          onRestart={() => setRunNonce((n) => n + 1)}
          speedIdx={speedIdx}
          setSpeedIdx={setSpeedIdx}
          speeds={SPEEDS}
          canStep={running || appliedRef.current < eventsRef.current.length}
        />
      </section>

      {/* sidebar */}
      <aside className="flex flex-col gap-5">
        {/* algorithm switcher */}
        <div className="flex flex-wrap gap-1.5 num text-[11px]">
          {ALGOS.map((a) => (
            <button
              key={a.id}
              onClick={() => a.id !== algo && setAlgo(a.id)}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                a.id === algo
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-border text-text-dim hover:text-text"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* live metrics */}
        <div className="grid grid-cols-2 gap-4 rounded border border-border bg-bg-raised p-4">
          <Metric
            label="step"
            value={fmtInt(stepShown)}
            accent
            sub={`of ${fmtInt(stepDenom)}${budget.maxEvents < 1e9 ? " · sampled" : ""}`}
          />
          <Metric label="elapsed" value={fmtMs(elapsed)} />
          <Metric label="nodes" value={fmtInt(model.nodes)} />
          <Metric label="backtracks" value={fmtInt(model.backtracks)} />
          {model.conflicts !== null && (
            <Metric label="conflicts" value={fmtInt(model.conflicts)} />
          )}
          {model.phase && (
            <Metric label="phase" value={model.phase} />
          )}
        </div>

        {/* outcome banner */}
        <OutcomeBanner running={running} settled={settled} puzzle={puzzle} algo={algo} />

        {/* explainer */}
        <AlgoExplainer meta={meta} />

        <button
          onClick={() => router.push("/")}
          className="num self-start text-[12px] text-text-faint hover:text-text-dim"
        >
          ← new puzzle
        </button>
      </aside>
    </div>
  );
}

function PlaybackBar({
  playing,
  onToggle,
  onStep,
  onRestart,
  speedIdx,
  setSpeedIdx,
  speeds,
  canStep,
}: {
  playing: boolean;
  onToggle: () => void;
  onStep: () => void;
  onRestart: () => void;
  speedIdx: number;
  setSpeedIdx: (n: number) => void;
  speeds: number[];
  canStep: boolean;
}) {
  return (
    <div className="flex w-full max-w-[600px] items-center gap-3 rounded border border-border bg-bg-raised px-3 py-2 num text-[12px]">
      <button
        onClick={onToggle}
        className="w-14 rounded bg-bg px-2 py-1.5 text-text hover:text-accent"
      >
        {playing ? "pause" : "play"}
      </button>
      <button
        onClick={onStep}
        disabled={!canStep}
        className="rounded bg-bg px-2 py-1.5 text-text-dim hover:text-text disabled:opacity-30"
      >
        step +1
      </button>
      <button
        onClick={onRestart}
        className="rounded bg-bg px-2 py-1.5 text-text-dim hover:text-text"
      >
        restart
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-text-faint">speed</span>
        <input
          type="range"
          min={0}
          max={speeds.length - 1}
          value={speedIdx}
          onChange={(e) => setSpeedIdx(Number(e.target.value))}
          className="w-28 accent-[var(--color-accent)]"
        />
        <span className="w-16 text-right text-text-dim">
          {speeds[speedIdx]}/f
        </span>
      </div>
    </div>
  );
}

function OutcomeBanner({
  running,
  settled,
  puzzle,
  algo,
}: {
  running: boolean;
  settled: null | { status: string; result: SolveResult | null; message?: string };
  puzzle: string;
  algo: AlgorithmName;
}) {
  if (running || !settled) return null;
  const clues = 81 - (puzzle.match(/0/g)?.length ?? 0);
  const r = settled.result;

  if (r?.terminatedReason === "solved") {
    return (
      <div className="rounded border border-ok/40 bg-ok/5 p-3 text-[12px] leading-relaxed text-text-dim">
        <span className="num text-ok">solved</span> — {fmtInt(r.nodes)} nodes,{" "}
        {fmtInt(r.backtracks)} backtracks in {fmtMs(r.runtimeMs)}.
      </div>
    );
  }
  if (r?.terminatedReason === "max_steps") {
    return (
      <div className="rounded border border-accent/40 bg-accent/5 p-3 text-[12px] leading-relaxed text-text-dim">
        <p>
          <span className="num text-accent">gave up</span> —{" "}
          {failureText(algo, {
            clues,
            nodes: r.nodes,
            cap: budgetFor(puzzle).maxSteps,
          })}
        </p>
        <p className="mt-1.5 text-text-faint">
          That&rsquo;s the designed outcome, not an error — see{" "}
          <a href="/benchmarks" className="text-accent hover:underline">
            benchmarks
          </a>{" "}
          for how often each algorithm hits this.
        </p>
      </div>
    );
  }
  if (r?.terminatedReason === "no_solution") {
    return (
      <div className="rounded border border-fail/40 bg-fail/5 p-3 text-[12px] text-text-dim">
        <span className="num text-fail">no solution</span> — the givens contradict
        each other.
      </div>
    );
  }
  return (
    <div className="rounded border border-fail/40 bg-fail/5 p-3 text-[12px] text-text-dim">
      <span className="num text-fail">error</span> — {settled.message ?? "run failed"}
    </div>
  );
}

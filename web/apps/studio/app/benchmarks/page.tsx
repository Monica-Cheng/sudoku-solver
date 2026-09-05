import type { Metadata } from "next";
import Link from "next/link";
import { Bars, type BarDatum } from "@/components/bench/Bars";
import { SolveRateMatrix } from "@/components/bench/SolveRateMatrix";
import { SweepChart } from "@/components/bench/SweepChart";
import { ConfusionGrid } from "@/components/bench/ConfusionGrid";
import {
  ABLATION,
  ABLATION_DELTAS,
  ALGO_LABEL,
  CHOSEN_THRESHOLD,
  CNN,
  METHODOLOGY,
  NODE_STATS,
  SOLVE_RATE,
  THRESHOLD_SWEEP,
  TIERS,
  TIMING,
  type AlgoId,
} from "@/lib/benchmarkData";

export const metadata: Metadata = {
  title: "benchmarks · sudoku solver studio",
  description:
    "Measured performance of the four solvers and the digit CNN: solve rates, node counts, timing, TypeScript vs Python, recognition accuracy.",
};

const ALGOS: AlgoId[] = ["backtracking", "forward_checking", "ac3", "min_conflicts"];

export default function BenchmarksPage() {
  return (
    <div className="mx-auto w-full max-w-[880px] flex-1 px-4 py-10">
      <header className="mb-10">
        <h1 className="num text-[15px] text-text">benchmarks</h1>
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          Every number on this page was measured, not estimated. The solver
          figures come from re-running all four algorithms over the same 102
          puzzles; the recognition figures from running the vision pipeline over
          24 photographed grids. The scripts are in{" "}
          <code className="num text-[12px] text-text-faint">benchmarks/</code>.
        </p>
      </header>

      {/* ---------- methodology ---------- */}
      <Section id="method" title="How this was measured">
        <dl className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-text-dim">
          <MethodRow k="Puzzle sets">{METHODOLOGY.puzzleSets}</MethodRow>
          <MethodRow k="Solver runs">{METHODOLOGY.solverRuns}</MethodRow>
          <MethodRow k="Caps">{METHODOLOGY.caps}</MethodRow>
          <MethodRow k="Timing">{METHODOLOGY.tracemalloc}</MethodRow>
          <MethodRow k="Parity">{METHODOLOGY.parity}</MethodRow>
          <MethodRow k="Hardware">{METHODOLOGY.hardware}</MethodRow>
        </dl>
      </Section>

      {/* ---------- solve rate ---------- */}
      <Section id="solve-rate" title="Solve rate">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          How many puzzles each algorithm actually finished before hitting its
          cap. The deterministic three clear everything down to the extreme set;
          there, backtracking finishes only 6 of 12. min-conflicts is run with
          three random seeds per puzzle, so its denominators are 3× — and it
          fails a slice of every tier, badly on the extreme set.
        </p>
        <SolveRateMatrix
          algos={ALGOS.map((id) => ({ id, label: ALGO_LABEL[id] }))}
          tiers={TIERS}
          rows={Object.fromEntries(
            ALGOS.map((id) => [id, SOLVE_RATE[id]]),
          )}
        />
        <Caption>
          Shaded by miss rate. backtracking 6/12 and min-conflicts 4/36 on the
          extreme set are the headline failures.
        </Caption>
      </Section>

      {/* ---------- search size ---------- */}
      <Section id="nodes" title="Search size">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          Search nodes per solve — for min-conflicts, repair iterations. Log
          scale: the range runs from <span className="num text-text">56</span>{" "}
          (forward-checking and AC-3, median, easy) to{" "}
          <span className="num text-text">1,400,000</span> (backtracking against
          the cap). The bar is the tier median; the red tick is the worst single
          puzzle in that tier.
        </p>
        <div className="flex flex-col gap-7">
          {TIERS.map((tier) => (
            <div key={tier}>
              <h3 className="num mb-1.5 text-[11px] uppercase tracking-wider text-text-faint">
                {tier}
              </h3>
              <Bars
                scale="log"
                min={10}
                max={1_400_000}
                data={ALGOS.map<BarDatum>((id) => ({
                  label: shortLabel(id),
                  value: NODE_STATS[id][tier].median,
                  marker: NODE_STATS[id][tier].worst,
                  text: `${fmt(NODE_STATS[id][tier].median)}  ·  worst ${fmt(
                    NODE_STATS[id][tier].worst,
                  )}`,
                }))}
              />
            </div>
          ))}
        </div>
        <Caption>
          Median bar, worst-case tick. backtracking&rsquo;s worst is the cap
          itself on hard and extreme; AC-3&rsquo;s worst never exceeds 100,560.
        </Caption>
      </Section>

      {/* ---------- FC vs AC-3 ---------- */}
      <Section id="fc-vs-ac3" title="Why forward-checking usually beats AC-3">
        <div className="space-y-3 text-[13px] leading-relaxed text-text-dim">
          <p>
            AC-3 is the more thorough technique: before it makes a single guess
            it propagates every constraint repeatedly until nothing more can be
            eliminated, which often shrinks the puzzle dramatically.
            Forward-checking only looks one move ahead. You would expect AC-3 to
            win. Mostly it doesn&rsquo;t.
          </p>
          <p>
            On the easy, medium and hard sets the two explore an almost identical
            number of nodes — medians of 56–63 either way. But forward-checking
            gets there in about{" "}
            <span className="num text-text">0.15 ms</span> and AC-3 in about{" "}
            <span className="num text-text">1.6 ms</span> (TypeScript). That
            10× gap is the upfront propagation pass: AC-3 pays it on every solve
            whether the puzzle needed it or not, and usually it didn&rsquo;t —
            forward-checking&rsquo;s minimum-remaining-values ordering walked
            straight to a solution anyway.
          </p>
          <p>
            The cost is worth paying on the hard puzzles. On the hard set there
            is a single puzzle where a one-move look-ahead misses a contradiction
            that propagation catches — forward-checking spent{" "}
            <span className="num text-text">149,731</span> nodes on it; AC-3
            spent <span className="num text-text">68</span>. And on the
            extreme set AC-3 searches less on average — median{" "}
            <span className="num text-text">7,310</span> nodes to
            forward-checking&rsquo;s <span className="num text-text">9,903</span>{" "}
            — which in Python makes it 6× faster there,{" "}
            <span className="num text-text">124 ms</span> against{" "}
            <span className="num text-text">747 ms</span>. In the TypeScript port
            AC-3&rsquo;s per-node cost is higher, so forward-checking still edges
            it on wall-clock. The robust statement is about nodes, not
            milliseconds: AC-3&rsquo;s worst case across all 102 puzzles is
            100,560; forward-checking and backtracking can both be driven to
            millions.
          </p>
        </div>
      </Section>

      {/* ---------- timing ---------- */}
      <Section id="timing" title="Timing">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          Median wall-clock per solve, by tier. Log scale. Both languages shown —
          same algorithm, same puzzles, same caps.
        </p>
        <div className="flex flex-col gap-7">
          {TIERS.map((tier) => (
            <div key={tier}>
              <h3 className="num mb-1.5 text-[11px] uppercase tracking-wider text-text-faint">
                {tier}
              </h3>
              <Bars
                scale="log"
                min={0.1}
                unit=" ms"
                data={ALGOS.flatMap<BarDatum>((id) => {
                  const t = TIMING[id][tier];
                  const rows: BarDatum[] = [
                    {
                      label: `${shortLabel(id)} · ts`,
                      value: t.ts,
                      accent: true,
                      text: `${fmtMs(t.ts)}`,
                    },
                  ];
                  if (t.py > 0)
                    rows.push({
                      label: `${shortLabel(id)} · py`,
                      value: t.py,
                      text: `${fmtMs(t.py)}`,
                    });
                  return rows;
                })}
              />
            </div>
          ))}
        </div>
        <Caption>
          TypeScript (solid accent) and Python for each algorithm. min-conflicts
          on the extreme set runs the full 200,000-iteration budget every time.
        </Caption>
      </Section>

      {/* ---------- TS vs PY ---------- */}
      <Section id="ts-vs-py" title="TypeScript vs Python">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          The port is behaviour-identical — same node counts, same solutions — so
          this is purely the runtime difference. TypeScript runs the same
          algorithms 2–27× faster, with no dependencies. The gap is widest where
          the inner loop does the most arithmetic per step: min-conflicts is
          19–27× faster across the board, AC-3 8–13× on ordinary puzzles.
          Backtracking&rsquo;s loop is already lean, so it gains the least
          (2–4×), and on the extreme set — where every runtime spends nearly all
          its time in that one loop — the margin for backtracking and AC-3
          narrows to 2–3×.
        </p>
        <SpeedupTable />
      </Section>

      {/* ---------- CNN ---------- */}
      <Section id="cnn" title="Digit recognition">
        <p className="mb-5 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          The CNN reads photographed grids one cell at a time. Measured on the{" "}
          {CNN.images} fixture images ({CNN.distinctPuzzles} distinct puzzles),
          on the {CNN.digitCells} cells where a digit is actually present.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat value={pct(CNN.perDigitAccuracy)} label="per-digit accuracy" accent />
          <Stat value={`${CNN.errors} / ${CNN.digitCells}`} label="misread cells" />
          <Stat value={`${CNN.gridsExact} / ${CNN.images}`} label="grids fully correct" />
          <Stat
            value={`${CNN.detectorErrors} / ${CNN.detectorCells}`}
            label="blank-vs-digit errors"
          />
        </div>

        <h3 className="num mt-8 mb-2 text-[11px] uppercase tracking-wider text-text-faint">
          confusion matrix
        </h3>
        <p className="mb-3 max-w-[62ch] text-[12.5px] leading-relaxed text-text-dim">
          Every misread is a <span className="num text-text">9</span> read as a 7
          or an 8, except one <span className="num text-text">4</span> read as a
          5. The digit 9 is the only one below 100% — its open loop degrades to a
          7 or 8 when the scan is thin.
        </p>
        <ConfusionGrid counts={CNN.confusion} />

        <h3 className="num mt-8 mb-2 text-[11px] uppercase tracking-wider text-text-faint">
          the three misreads
        </h3>
        <ul className="flex flex-col gap-1 text-[12.5px] text-text-dim">
          {CNN.misreads.map((m) => (
            <li key={m.image} className="num">
              <span className="text-text-faint">{m.image}</span> {m.cell} —{" "}
              <span className="text-text">{m.was}</span> read as{" "}
              <span className="text-fail">{m.read}</span>
              <span className="text-text-faint">
                {" "}
                · confidence {m.conf.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ---------- ablation ---------- */}
      <Section id="ablation" title="Preprocessing ablation">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          Two cheap steps carry most of the accuracy. Eroding each 28×28 cell by
          one pixel thins the strokes toward what the model trained on; resizing
          with <code className="num text-[12px]">INTER_AREA</code> instead of{" "}
          <code className="num text-[12px]">INTER_NEAREST</code> keeps the
          antialiased edges the model expects. Same model, same images, only the
          preprocessing changed.
        </p>
        <Bars
          scale="linear"
          min={0}
          max={100}
          unit="%"
          data={ABLATION.map<BarDatum>((a) => ({
            label: a.label,
            value: +(a.accuracy * 100).toFixed(2),
            accent: "shipped" in a && a.shipped === true,
            text: `${(a.accuracy * 100).toFixed(2)}%  ·  ${a.errors} errors`,
          }))}
          labelWidth={260}
        />
        <Caption>
          Erosion is worth {ABLATION_DELTAS.erode.toFixed(1)} points,{" "}
          INTER_AREA {ABLATION_DELTAS.interpolation.toFixed(1)} points, the two
          together {ABLATION_DELTAS.both.toFixed(1)}.
        </Caption>
      </Section>

      {/* ---------- threshold ---------- */}
      <Section id="threshold" title="Confidence threshold">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          A recognised digit below{" "}
          <span className="num text-text">{CHOSEN_THRESHOLD.toFixed(2)}</span>{" "}
          confidence is flagged for the reviewer on{" "}
          <Link href="/verify" className="text-accent hover:underline">
            /verify
          </Link>
          . Correct predictions average {CNN.meanConfCorrect.toFixed(2)}{" "}
          confidence, wrong ones {CNN.meanConfWrong.toFixed(2)} — but the tails
          overlap: the lowest correct is {CNN.minConfCorrect.toFixed(2)}, the
          highest wrong is {CNN.maxConfWrong.toFixed(2)}.
        </p>
        <SweepChart
          points={THRESHOLD_SWEEP.map((s) => ({
            threshold: s.threshold,
            falseAlarmPct: s.fpPct,
            missPct: s.fnPct,
          }))}
          chosen={CHOSEN_THRESHOLD}
        />
        <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          Below <span className="num text-text">0.80</span> the flag misses two
          of the three misreads. From <span className="num text-text">0.80</span>{" "}
          to <span className="num text-text">0.85</span> it catches the same two
          — the third is a confident misread on a blurred photo (0.95) that no
          threshold below 0.97 reaches. Going past 0.85 only piles on false
          alarms: 4.5% of correct cells flagged at 0.85, 8.4% at 0.90, 19% at
          0.95. 0.85 keeps a margin above the worst caught misread (0.76) without
          drowning the reviewer. The legality check — two of the same digit in a
          row, column or box — is the more decisive net, and it flags all three
          fixture images with misreads.
        </p>
      </Section>

      <footer className="mt-14 border-t border-border pt-6 num text-[11px] text-text-faint">
        Solver data:{" "}
        <code>benchmarks/run_solver_bench.py</code> ·{" "}
        <code>web/packages/solver-core/bench/bench.ts</code>. Recognition data:{" "}
        <code>benchmarks/run_cnn_bench.py</code> ·{" "}
        <code>scripts/pick_threshold.py</code>. Raw JSON in{" "}
        <code>benchmarks/results/</code>.
      </footer>
    </div>
  );
}

/* ---------- helpers & small components ---------- */

function shortLabel(id: AlgoId): string {
  return id === "forward_checking"
    ? "fwd-check"
    : id === "min_conflicts"
      ? "min-conf"
      : id === "backtracking"
        ? "backtrack"
        : "ac-3";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${ms.toFixed(0)} ms`;
  if (ms >= 1) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}
function pct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-16">
      <h2 className="mb-4 border-b border-border pb-2 num text-[13px] text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MethodRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="num text-[11px] uppercase tracking-wider text-text-faint">
        {k}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[11.5px] leading-relaxed text-text-faint">{children}</p>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded border border-border bg-bg-raised p-3">
      <div
        className={`num text-[18px] tabular-nums ${accent ? "text-accent" : "text-text"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-tight text-text-faint">{label}</div>
    </div>
  );
}

function SpeedupTable() {
  const ALGOS: AlgoId[] = [
    "backtracking",
    "forward_checking",
    "ac3",
    "min_conflicts",
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="num text-text-faint">
            <th className="p-2 text-left font-normal">algorithm</th>
            {TIERS.map((t) => (
              <th key={t} className="p-2 text-right font-normal capitalize">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALGOS.map((id) => (
            <tr key={id} className="border-t border-border/60">
              <td className="whitespace-nowrap p-2 text-text-dim">
                {ALGO_LABEL[id]}
              </td>
              {TIERS.map((t) => {
                const { py, ts } = TIMING[id][t];
                const x = py > 0 && ts > 0 ? py / ts : null;
                return (
                  <td key={t} className="p-2 text-right num">
                    {x ? (
                      <span className="text-text">{x.toFixed(1)}×</span>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
          Every number on this page came from an actual run, not a guess. The
          solver numbers come from running all four algorithms on the same 102
          puzzles; the digit-reading numbers come from running that pipeline on
          24 real photographed grids. Want to check our work? The scripts are
          in <code className="num text-[12px] text-text-faint">benchmarks/</code>.
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
          One &ldquo;attempt&rdquo; means one algorithm running one puzzle,
          one time. A lower solve rate means the algorithm gave up before it
          found the answer — it hit its cap (ran out of guesses, or swaps)
          with the puzzle still unsolved. Backtracking, forward-checking, and
          AC-3 each get one attempt per puzzle, and clear almost everything —
          except backtracking, which finishes only 6 of 12 on the hardest set.
          Min-conflicts is different: it gets three random starts per puzzle,
          so its totals are 3× bigger than the others&rsquo;. It also fails
          more often — badly, on the hardest set.
        </p>
        <SolveRateMatrix
          algos={ALGOS.map((id) => ({ id, label: ALGO_LABEL[id] }))}
          tiers={TIERS}
          rows={Object.fromEntries(
            ALGOS.map((id) => [id, SOLVE_RATE[id]]),
          )}
        />
        <Caption>
          Darker cells mean more failed attempts. The two big ones: backtracking
          6/12 and min-conflicts 4/36, both on the extreme set.
        </Caption>
      </Section>

      {/* ---------- search size ---------- */}
      <Section id="nodes" title="Search size">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          A &ldquo;node&rdquo; is one guess the algorithm makes while searching
          — for min-conflicts, it&rsquo;s one swap instead. Fewer nodes means
          less work, which usually means a smarter search. This is a log
          scale (each gridline is 10× the last one, not evenly spaced) because
          the numbers here are so spread out: from just{" "}
          <span className="num text-text">56</span> nodes (forward-checking
          and AC-3&rsquo;s median on easy puzzles) up to{" "}
          <span className="num text-text">1,400,000</span> (backtracking
          slamming into its cap). Each bar is the typical case for that tier;
          the red tick is the single worst puzzle in it.
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
          The bar is the typical case, the tick is the worst case.
          Backtracking&rsquo;s worst case on hard and extreme is literally
          the cap — it just runs out of budget. AC-3&rsquo;s worst case never
          goes above 100,560, even on the puzzles that beat everyone else.
        </Caption>
      </Section>

      {/* ---------- FC vs AC-3 ---------- */}
      <Section id="fc-vs-ac3" title="Why forward-checking usually beats AC-3">
        <div className="space-y-3 text-[13px] leading-relaxed text-text-dim">
          <p>
            AC-3 does its homework before guessing anything: it repeatedly
            crosses off digits that can&rsquo;t possibly work anywhere else on
            the board, based on what&rsquo;s already placed — a process called
            constraint propagation. Forward-checking is lazier: it only
            rechecks the cells affected by the very last guess, one move
            ahead. You&rsquo;d expect all that extra homework to make AC-3 win
            more often. Mostly, it doesn&rsquo;t.
          </p>
          <p>
            On the easy, medium, and hard sets the two end up making almost the
            same number of guesses — medians of 56–63 either way. But
            forward-checking gets there in about{" "}
            <span className="num text-text">0.15 ms</span> and AC-3 takes about{" "}
            <span className="num text-text">1.6 ms</span> (measured in
            TypeScript). That roughly 10× gap is the cost of AC-3&rsquo;s
            upfront propagation: it pays that cost on every solve, whether the
            puzzle needed it or not — and usually it didn&rsquo;t, because
            forward-checking&rsquo;s cell-picking rule (called MRV, short for
            &ldquo;minimum remaining values&rdquo; — always guess the cell
            with the fewest options left) walked straight to a solution
            anyway.
          </p>
          <p>
            The homework pays off on harder puzzles. On the hard set there is
            one puzzle where a one-move lookahead misses a contradiction that
            AC-3&rsquo;s deeper propagation catches — forward-checking burns{" "}
            <span className="num text-text">149,731</span> guesses on it; AC-3
            needs just <span className="num text-text">68</span>. On the
            extreme set AC-3 also searches less on average — a median of{" "}
            <span className="num text-text">7,310</span> guesses against
            forward-checking&rsquo;s <span className="num text-text">9,903</span>{" "}
            — which makes it 6× faster in Python:{" "}
            <span className="num text-text">124 ms</span> versus{" "}
            <span className="num text-text">747 ms</span>. In the TypeScript
            port, though, each of AC-3&rsquo;s guesses costs more to compute,
            so forward-checking still wins on wall-clock there. The number
            that actually matters is guesses made, not milliseconds spent:
            AC-3&rsquo;s worst case across all 102 puzzles tops out at
            100,560, while forward-checking and backtracking can both spiral
            into the millions.
          </p>
        </div>
      </Section>

      {/* ---------- timing ---------- */}
      <Section id="timing" title="Timing">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          This is wall-clock time — actual milliseconds, stopwatch style —
          by tier, so lower bars are better. Log scale again, same reason as
          before. Both languages ran the same algorithm on the same puzzles
          with the same caps; the only thing that changed is which language
          executed the code. TypeScript comes out faster here, but not
          because it&rsquo;s doing something smarter. The JavaScript engine
          compiles the code down to native machine instructions while it
          runs — a trick called JIT (just-in-time) compilation — while Python
          is interpreting it line by line the whole time.
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
          <span className="mr-3 inline-flex items-center gap-1.5 align-middle">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: "var(--color-accent)" }}
            />
            TypeScript
          </span>
          <span className="mr-1 inline-flex items-center gap-1.5 align-middle">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                background:
                  "color-mix(in oklab, var(--color-accent) 34%, var(--color-bg-raised))",
              }}
            />
            Python
          </span>
          — for each algorithm. min-conflicts on the extreme set always burns
          through its whole 200,000-iteration budget, no matter which
          language runs it.
        </Caption>
      </Section>

      {/* ---------- TS vs PY ---------- */}
      <Section id="ts-vs-py" title="TypeScript vs Python">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          The TypeScript port behaves exactly like the Python original — same
          node counts, same solutions — so this section is measuring pure
          speed, nothing else. TypeScript runs the same algorithms 2–27×
          faster, with zero external dependencies. The gap is biggest wherever
          the inner loop does the most arithmetic per step: min-conflicts is
          19–27× faster across the board, AC-3 is 8–13× faster on ordinary
          puzzles. Backtracking&rsquo;s loop is already about as simple as it
          gets, so it gains the least (2–4×). And on the extreme set — where
          almost all the time is spent inside that one loop anyway — even
          backtracking and AC-3&rsquo;s edge narrows to 2–3×.
        </p>
        <SpeedupTable />
      </Section>

      {/* ---------- CNN ---------- */}
      <Section id="cnn" title="Digit recognition">
        <p className="mb-5 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          CNN stands for convolutional neural network — it&rsquo;s the model
          that looks at a photo of a Sudoku grid and reads the digit in each
          cell. We tested it on {CNN.images} hand-checked photos of real
          puzzles ({CNN.distinctPuzzles} different puzzles — some got
          photographed more than once), so we already know the right answer
          for every cell going in. Across the {CNN.digitCells} cells that
          actually had a digit written in them, it got{" "}
          {pct(CNN.perDigitAccuracy)} right.
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
          A confusion matrix just shows which digits get mixed up with which —
          for every true digit, what did the model actually guess. Here,
          almost every mistake is a <span className="num text-text">9</span>{" "}
          misread as a 7 or an 8, plus one lone{" "}
          <span className="num text-text">4</span> misread as a 5. In fact, 9
          is the only digit that isn&rsquo;t 100% accurate — its open loop can
          look like a 7 or an 8 when the scan comes out thin.
        </p>
        <ConfusionGrid counts={CNN.confusion} />

        <h3 className="num mt-8 mb-2 text-[11px] uppercase tracking-wider text-text-faint">
          the three misreads
        </h3>
        <p className="mb-2 max-w-[62ch] text-[12.5px] leading-relaxed text-text-dim">
          Confidence is just how sure the model is about its own guess, from
          0 to 1. The bad case isn&rsquo;t low confidence — that at least
          warns you. It&rsquo;s high confidence on a wrong answer, because
          then the model has no idea it screwed up.
        </p>
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
          Same model, same photos — here we only changed how the images get
          prepared before the model ever sees them. Start with neither trick
          and accuracy is just 88.61%. Resizing with{" "}
          <code className="num text-[12px]">INTER_AREA</code> — a resize
          method that blends neighboring pixels together instead of just
          picking one, which keeps edges smooth when shrinking the image down
          to 28×28 pixels — is worth 7.8 percentage points on its own.
          Thinning the digit strokes by one pixel, a step called erosion, so
          they match what the model saw during training, is worth 6.3
          percentage points on its own. Do both, and accuracy jumps 10.9
          points in total, from 88.61% up to 99.55% — the version we actually
          ship.
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
          Erosion alone: +{ABLATION_DELTAS.erode.toFixed(1)} points.
          INTER_AREA alone: +{ABLATION_DELTAS.interpolation.toFixed(1)} points.
          Both together: +{ABLATION_DELTAS.both.toFixed(1)} points.
        </Caption>
      </Section>

      {/* ---------- threshold ---------- */}
      <Section id="threshold" title="Confidence threshold">
        <p className="mb-4 max-w-[62ch] text-[13px] leading-relaxed text-text-dim">
          The threshold is just a cutoff: if the model&rsquo;s confidence in a
          digit drops below{" "}
          <span className="num text-text">{CHOSEN_THRESHOLD.toFixed(2)}</span>
          , we flag that cell and ask you to confirm it on{" "}
          <Link href="/verify" className="text-accent hover:underline">
            /verify
          </Link>
          . Set the threshold lower and you flag more cells — more false
          alarms, but fewer real mistakes slip through. Set it higher and you
          flag fewer cells — less annoying, but riskier.{" "}
          {CHOSEN_THRESHOLD.toFixed(2)} is the balance point we landed on.
          On our data, correct guesses average {CNN.meanConfCorrect.toFixed(2)}{" "}
          confidence and wrong ones average {CNN.meanConfWrong.toFixed(2)} —
          but the two overlap at the edges: the least-confident correct guess
          was only {CNN.minConfCorrect.toFixed(2)}, and the most-confident
          wrong guess still hit {CNN.maxConfWrong.toFixed(2)}.
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
          Below <span className="num text-text">0.80</span>, the flag misses
          two of the three misreads — not good. From{" "}
          <span className="num text-text">0.80</span> to{" "}
          <span className="num text-text">0.85</span> it catches the same
          two, but no more: the third misread is a confident 0.95 guess on a
          blurry photo, and nothing below a 0.97 threshold would catch it.
          Push past 0.85 and you just pile on false alarms for no extra
          benefit: 4.5% of correct cells get flagged at 0.85, 8.4% at 0.90,
          19% at 0.95. So 0.85 is the sweet spot — it sits safely above the
          worst misread it does catch (0.76) without burying the reviewer in
          false alarms. The bigger safety net, honestly, is the legality
          check — spotting the same digit twice in a row, column, or box —
          which alone catches all three fixture photos that had a misread.
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

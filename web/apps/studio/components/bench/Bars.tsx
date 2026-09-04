/**
 * Horizontal bar chart. Linear or log scale. Pure SVG, no deps. The value
 * label sits at the end of each bar; a monospace row label sits to the left.
 */

export interface BarDatum {
  label: string;
  value: number;
  /** optional second value drawn as a hollow marker (e.g. worst case) */
  marker?: number;
  accent?: boolean;
  /** override formatted text at the bar end */
  text?: string;
}

export function Bars({
  data,
  scale = "linear",
  unit = "",
  max,
  min,
  height = 22,
  gap = 8,
  labelWidth = 132,
}: {
  data: BarDatum[];
  scale?: "linear" | "log";
  unit?: string;
  max?: number;
  min?: number;
  height?: number;
  gap?: number;
  labelWidth?: number;
}) {
  const values = data.flatMap((d) => [d.value, d.marker ?? d.value]);
  const hi = max ?? Math.max(...values);
  const loRaw = min ?? Math.min(...values.filter((v) => v > 0), hi);
  // snap the log floor to a power of ten so gridlines land on their labels
  const lo =
    scale === "log"
      ? 10 ** Math.floor(Math.log10(Math.max(loRaw, 1e-6)))
      : 0;

  const plotW = 1000; // viewBox units; scales to container width
  const barArea = plotW - labelWidth - 8;

  const x = (v: number) => {
    if (scale === "log") {
      const a = Math.log10(Math.max(v, lo));
      const b = Math.log10(Math.max(hi, lo * 10));
      const c = Math.log10(lo);
      return labelWidth + ((a - c) / (b - c)) * barArea;
    }
    return labelWidth + (v / hi) * barArea;
  };

  const rowH = height + gap;
  const svgH = data.length * rowH + 18;

  const ticks =
    scale === "log"
      ? logTicks(lo, hi)
      : linTicks(hi);

  return (
    <svg
      viewBox={`0 0 ${plotW} ${svgH}`}
      className="w-full"
      style={{ maxHeight: svgH * 1.4 }}
      role="img"
    >
      {/* gridlines + tick labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={0}
            y2={data.length * rowH}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <text
            x={x(t)}
            y={svgH - 4}
            fill="var(--color-text-faint)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            textAnchor="middle"
          >
            {fmtTick(t)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const y = i * rowH;
        const barEnd = x(d.value);
        return (
          <g key={d.label}>
            <text
              x={labelWidth - 10}
              y={y + height / 2}
              fill="var(--color-text-dim)"
              fontSize={12}
              fontFamily="var(--font-mono)"
              textAnchor="end"
              dominantBaseline="central"
            >
              {d.label}
            </text>
            <rect
              x={labelWidth}
              y={y}
              width={Math.max(barEnd - labelWidth, 1)}
              height={height}
              rx={2}
              fill={
                d.accent
                  ? "var(--color-accent)"
                  : "color-mix(in oklab, var(--color-accent) 34%, var(--color-bg-raised))"
              }
            />
            {d.marker !== undefined && d.marker !== d.value && (
              <line
                x1={x(d.marker)}
                x2={x(d.marker)}
                y1={y - 2}
                y2={y + height + 2}
                stroke="var(--color-fail)"
                strokeWidth={2}
              />
            )}
            {(() => {
              const label = d.text ?? `${fmtNum(d.value)}${unit}`;
              const inside = barEnd > plotW * 0.6;
              const fill = !inside
                ? "var(--color-text)"
                : d.accent
                  ? "var(--color-bg)"
                  : "var(--color-text)";
              return (
                <text
                  x={inside ? barEnd - 8 : barEnd + 8}
                  y={y + height / 2}
                  fill={fill}
                  fontSize={12}
                  fontFamily="var(--font-mono)"
                  textAnchor={inside ? "end" : "start"}
                  dominantBaseline="central"
                >
                  {label}
                </text>
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  let p = Math.round(Math.log10(lo));
  const top = Math.floor(Math.log10(hi) + 1e-9); // largest power of ten <= hi
  for (; p <= top; p++) out.push(10 ** p);
  return out;
}
function linTicks(hi: number): number[] {
  const step = niceStep(hi / 4);
  const out: number[] = [];
  for (let v = 0; v <= hi + step / 2; v += step) out.push(v);
  return out;
}
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
}
function fmtTick(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${v / 1_000_000}M`;
  if (v >= 1_000) return `${v / 1_000}k`;
  return String(v);
}
function fmtNum(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US");
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

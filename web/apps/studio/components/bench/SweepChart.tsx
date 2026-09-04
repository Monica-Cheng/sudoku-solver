/**
 * Confidence-threshold sweep. Two series over threshold on the x-axis:
 * false-alarm rate (correct cells flagged) and miss rate (wrong cells not
 * flagged). A vertical rule marks the chosen threshold.
 */

export interface SweepPoint {
  threshold: number;
  falseAlarmPct: number; // 0..100
  missPct: number; // 0..100
}

export function SweepChart({
  points,
  chosen,
}: {
  points: SweepPoint[];
  chosen: number;
}) {
  const W = 1000;
  const H = 320;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 44;

  const xs = points.map((p) => p.threshold);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const x = (t: number) => padL + ((t - xMin) / (xMax - xMin)) * (W - padL - padR);
  const y = (pct: number) => padT + (1 - pct / 100) * (H - padT - padB);

  const line = (key: "falseAlarmPct" | "missPct") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(p.threshold)},${y(p[key])}`).join(" ");

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-border)"
          />
          <text
            x={padL - 8}
            y={y(t)}
            fill="var(--color-text-faint)"
            fontSize={11}
            fontFamily="var(--font-mono)"
            textAnchor="end"
            dominantBaseline="central"
          >
            {t}%
          </text>
        </g>
      ))}

      {points.map((p) => (
        <text
          key={p.threshold}
          x={x(p.threshold)}
          y={H - padB + 16}
          fill="var(--color-text-faint)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {p.threshold.toFixed(2)}
        </text>
      ))}

      {/* chosen threshold rule */}
      <line
        x1={x(chosen)}
        x2={x(chosen)}
        y1={padT}
        y2={H - padB}
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <text
        x={x(chosen) + 6}
        y={padT + 12}
        fill="var(--color-accent)"
        fontSize={11}
        fontFamily="var(--font-mono)"
      >
        chosen · {chosen.toFixed(2)}
      </text>

      <path d={line("falseAlarmPct")} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <path
        d={line("missPct")}
        fill="none"
        stroke="var(--color-fail)"
        strokeWidth={2}
      />
      {points.map((p) => (
        <g key={`pt${p.threshold}`}>
          <circle cx={x(p.threshold)} cy={y(p.falseAlarmPct)} r={2.5} fill="var(--color-accent)" />
          <circle cx={x(p.threshold)} cy={y(p.missPct)} r={2.5} fill="var(--color-fail)" />
        </g>
      ))}

      <text
        x={W - padR}
        y={y(points[points.length - 1].falseAlarmPct) - 8}
        fill="var(--color-accent)"
        fontSize={11}
        fontFamily="var(--font-mono)"
        textAnchor="end"
      >
        false alarms
      </text>
      <text
        x={W - padR}
        y={y(points[points.length - 1].missPct) - 8}
        fill="var(--color-fail)"
        fontSize={11}
        fontFamily="var(--font-mono)"
        textAnchor="end"
      >
        missed misreads
      </text>
    </svg>
  );
}

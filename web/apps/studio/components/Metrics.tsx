"use client";

export function Metric({
  label,
  value,
  accent = false,
  sub,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </span>
      <span
        className={`num text-[15px] tabular-nums ${accent ? "text-accent" : "text-text"}`}
      >
        {value}
      </span>
      {sub && <span className="num text-[10px] text-text-faint">{sub}</span>}
    </div>
  );
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}
export function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

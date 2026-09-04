/**
 * 4 algorithms x 4 tiers grid of solve rates. Each cell shows solved / total
 * and is tinted by the fraction — full solves read neutral, misses read hot.
 */

export interface RateCell {
  solved: number;
  total: number;
  /** e.g. "9 timeouts" */
  note?: string;
}

export function SolveRateMatrix({
  algos,
  tiers,
  rows,
}: {
  algos: { id: string; label: string }[];
  tiers: string[];
  rows: Record<string, Record<string, RateCell>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="num text-text-faint">
            <th className="p-2 text-left font-normal" />
            {tiers.map((t) => (
              <th key={t} className="p-2 text-right font-normal capitalize">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {algos.map((a) => (
            <tr key={a.id} className="border-t border-border/60">
              <td className="whitespace-nowrap p-2 text-text-dim">{a.label}</td>
              {tiers.map((t) => {
                const c = rows[a.id]?.[t];
                if (!c)
                  return (
                    <td key={t} className="p-2 text-right text-text-faint">
                      —
                    </td>
                  );
                const frac = c.total ? c.solved / c.total : 1;
                const miss = 1 - frac;
                return (
                  <td
                    key={t}
                    className="p-2 text-right align-top"
                    style={{
                      background:
                        miss > 0
                          ? `color-mix(in oklab, var(--color-fail) ${Math.round(
                              miss * 42,
                            )}%, transparent)`
                          : "transparent",
                    }}
                  >
                    <span
                      className={
                        frac === 1
                          ? "num text-text"
                          : frac === 0
                            ? "num text-fail"
                            : "num text-accent"
                      }
                    >
                      {c.solved}/{c.total}
                    </span>
                    {c.note && (
                      <span className="block num text-[10px] text-text-faint">
                        {c.note}
                      </span>
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

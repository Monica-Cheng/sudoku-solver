/**
 * Digit confusion matrix: rows = true digit, columns = predicted digit. The
 * diagonal is correct; off-diagonal cells are misreads, tinted hot. Built for
 * a near-perfect classifier, so blanks read as "0".
 */

export function ConfusionGrid({
  counts,
}: {
  /** { "9->8": 1, "3->3": 77, ... } */
  counts: Record<string, number>;
}) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const get = (t: number, p: number) => counts[`${t}->${p}`] ?? 0;
  const rowTotal = (t: number) => digits.reduce((s, p) => s + get(t, p), 0);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse num text-[11px]">
        <thead>
          <tr className="text-text-faint">
            <th className="p-1.5 font-normal">
              <span className="block text-right">true ↓</span>
              <span className="block text-right">pred →</span>
            </th>
            {digits.map((p) => (
              <th key={p} className="w-9 p-1.5 text-center font-normal text-text-dim">
                {p}
              </th>
            ))}
            <th className="p-1.5 pl-3 text-right font-normal">n</th>
            <th className="p-1.5 pl-3 text-right font-normal">acc</th>
          </tr>
        </thead>
        <tbody>
          {digits.map((t) => {
            const total = rowTotal(t);
            const correct = get(t, t);
            return (
              <tr key={t}>
                <td className="p-1.5 text-right text-text-dim">{t}</td>
                {digits.map((p) => {
                  const v = get(t, p);
                  const onDiag = t === p;
                  return (
                    <td
                      key={p}
                      className="p-1.5 text-center"
                      style={{
                        background: onDiag
                          ? v
                            ? "color-mix(in oklab, var(--color-accent) 12%, transparent)"
                            : "transparent"
                          : v
                            ? "color-mix(in oklab, var(--color-fail) 40%, transparent)"
                            : "transparent",
                        color: v
                          ? onDiag
                            ? "var(--color-text-dim)"
                            : "var(--color-fail)"
                          : "var(--color-text-faint)",
                      }}
                    >
                      {v || "·"}
                    </td>
                  );
                })}
                <td className="p-1.5 pl-3 text-right text-text-dim">{total}</td>
                <td className="p-1.5 pl-3 text-right text-text-dim">
                  {total ? `${((correct / total) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import type { MerchantTotal } from './api';

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function TopMerchants(props: { data: MerchantTotal[] }) {
  if (props.data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500">
        No merchant data yet.
      </div>
    );
  }

  const rows = props.data.map((m) => ({
    name: m.key,
    total: Number(m.total),
    count: m.count,
  }));

  const max = rows[0]!.total;

  return (
    <div className="rounded-xl border border-zinc-200 p-5">
      <div className="mb-4 flex items-center gap-2">
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="shrink-0 text-zinc-400">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <h2 className="text-base font-semibold text-zinc-900">Top merchants</h2>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={row.name} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">{i + 1}</span>
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="mb-1 block truncate text-sm text-zinc-700">{row.name}</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-teal-700"
                    style={{ width: `${(row.total / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums text-zinc-900">
                {fmt(row.total)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

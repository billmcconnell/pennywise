import type { BudgetStatus } from './api';

const fmt = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function bar(pct: number, isOver: boolean) {
  const fill = Math.min(pct, 100);
  const color = isOver
    ? 'bg-red-500'
    : pct >= 80
      ? 'bg-amber-400'
      : 'bg-emerald-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${fill}%` }} />
    </div>
  );
}

export function BudgetStatusPanel({ data }: { data: BudgetStatus[] }) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="shrink-0 text-zinc-400">
          <line x1="3" y1="6" x2="17" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="13" y2="18"/>
        </svg>
        <h2 className="text-base font-semibold text-zinc-900">Budget status</h2>
      </div>
      <div className="flex flex-col gap-3">
        {data.map((b) => (
          <div key={b.categoryId} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm font-medium capitalize">{b.categoryName ?? '—'}</p>
              {bar(b.pct, b.isOver)}
              <div className="mt-0.5 text-xs text-zinc-500">
                {b.isOver ? (
                  <span className="text-red-600">
                    {fmt(String(Math.abs(Number(b.remaining))))} over budget
                  </span>
                ) : (
                  <span>{fmt(b.remaining)} remaining · {b.pct}% used</span>
                )}
              </div>
            </div>
            <span className="shrink-0 tabular-nums text-xs text-zinc-500 pt-0.5">
              {fmt(b.actual)}{' '}
              <span className="text-zinc-400">/ {fmt(b.budget)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

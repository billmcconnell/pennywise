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
      <h2 className="mb-3 text-base font-semibold text-zinc-900">Budget status</h2>
      <div className="flex flex-col gap-3">
        {data.map((b) => (
          <div key={b.categoryId}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium capitalize">{b.categoryName ?? '—'}</span>
              <span className="shrink-0 tabular-nums text-xs text-zinc-500">
                {fmt(b.actual)}{' '}
                <span className="text-zinc-400">/ {fmt(b.budget)}</span>
              </span>
            </div>
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
        ))}
      </div>
    </div>
  );
}

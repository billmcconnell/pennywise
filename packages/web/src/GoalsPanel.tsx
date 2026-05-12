import type { SavingsGoal } from './api';

const fmt = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function GoalsPanel({ goals }: { goals: SavingsGoal[] }) {
  const active = goals.filter((g) => g.pct < 100);
  if (active.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-3 text-base font-semibold text-zinc-900">Savings goals</h2>
      <div className="flex flex-col gap-3">
        {active.map((g) => {
          const barColor =
            g.onTrack === false ? 'bg-amber-400' : 'bg-teal-500';
          return (
            <div key={g.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{g.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-zinc-500">
                  {fmt(g.currentAmount)}{' '}
                  <span className="text-zinc-400">/ {fmt(g.targetAmount)}</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(g.pct, 100)}%` }}
                />
              </div>
              <div className="mt-0.5 flex gap-3 text-xs text-zinc-500">
                <span>{g.pct}% · {fmt(g.remaining)} to go</span>
                {g.daysRemaining !== null && g.daysRemaining > 0 && (
                  <span>{g.daysRemaining}d left</span>
                )}
                {g.onTrack === false && (
                  <span className="text-amber-600">Behind</span>
                )}
                {g.onTrack === true && (
                  <span className="text-emerald-600">On track</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

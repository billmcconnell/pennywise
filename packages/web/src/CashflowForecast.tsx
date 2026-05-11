import type { ForecastData } from './api';

const usd = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const usdFull = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function CashflowForecast({
  data,
  isLoading,
}: {
  data: ForecastData | undefined;
  isLoading?: boolean;
}) {
  if (isLoading) return <CashflowForecastSkeleton />;
  if (!data || (data.recurringItems.length === 0)) return null;

  const net = Number(data.projectedNet);
  const netColor = net >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const netLabel = net >= 0 ? 'surplus' : 'shortfall';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Next month forecast</h2>
        <span className="text-xs text-zinc-400">
          based on {data.basedOnMonths}-month recurring patterns
        </span>
      </div>

      {/* Summary row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Projected income" value={usd(data.projectedIncome)} color="text-emerald-600" />
        <Stat label="Projected expenses" value={usd(data.projectedExpenses)} color="text-rose-600" />
        <Stat
          label={`Projected ${netLabel}`}
          value={usd(Math.abs(net).toFixed(2))}
          color={netColor}
        />
      </div>

      {/* Recurring items */}
      <div className="divide-y divide-zinc-100">
        {data.recurringItems.slice(0, 8).map((item) => {
          const amt = Number(item.avgMonthlyAmount);
          const isExpense = amt > 0;
          return (
            <div key={item.description} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">{item.description}</p>
                <p className="text-xs text-zinc-400">
                  {item.categoryName ?? 'Uncategorized'}
                  {' · '}
                  {item.monthCount} of {data.basedOnMonths} months
                </p>
              </div>
              <span
                className={`shrink-0 font-display tabular-nums text-sm font-semibold ${
                  isExpense ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {isExpense ? '' : '+'}
                {usdFull(item.avgMonthlyAmount)}/mo
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`font-display tabular-nums text-lg font-bold whitespace-nowrap ${color}`}>
        {value}
      </p>
    </div>
  );
}

function CashflowForecastSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 h-4 w-40 rounded bg-zinc-200" />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="mb-1 h-2.5 w-24 rounded bg-zinc-200" />
            <div className="h-5 w-20 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between py-2">
          <div className="h-3.5 w-40 rounded bg-zinc-200" />
          <div className="h-3.5 w-16 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

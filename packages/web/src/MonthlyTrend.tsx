import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyPoint } from './api';

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtFull = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function changePct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function SideStat({
  label,
  amount,
  pct,
  positiveIsGood,
  iconBg,
  iconPath,
}: {
  label: string;
  amount: number;
  pct: number | null;
  positiveIsGood: boolean;
  iconBg: string;
  iconPath: React.ReactNode;
}) {
  const absP = pct !== null ? Math.abs(pct) : null;
  const isGood = pct !== null ? (positiveIsGood ? pct > 0 : pct < 0) : null;
  const trendColor =
    absP === null || absP < 0.5
      ? 'text-zinc-400'
      : isGood
        ? 'text-emerald-600'
        : 'text-amber-600';
  const arrow = pct !== null ? (pct > 0.5 ? '↗' : pct < -0.5 ? '↙' : '') : '';

  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          {iconPath}
        </svg>
      </div>
      <div>
        <p className="text-xs text-zinc-400">{label}</p>
        <p
          className="font-display text-lg font-bold tabular-nums text-zinc-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {fmt(amount)}
        </p>
        {absP !== null && absP >= 0.5 && (
          <p className={`text-xs font-medium ${trendColor}`}>
            {absP.toFixed(1)}% {arrow}
          </p>
        )}
      </div>
    </div>
  );
}

export function MonthlyTrend(props: { data: MonthlyPoint[]; months?: number }) {
  if (props.data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-400">
        No monthly data yet.
      </div>
    );
  }

  // Expenses rendered as negative so they appear below the x-axis
  const series = props.data.map((p) => ({
    month: p.month.slice(2),
    income: Number(p.income),
    expenses: -Number(p.expenses),
  }));

  // Side panel: last month vs second-to-last
  const last = props.data[props.data.length - 1]!;
  const prev = props.data[props.data.length - 2];
  const lastIncome = Number(last.income);
  const lastExpenses = Number(last.expenses);
  const incomePct = prev ? changePct(lastIncome, Number(prev.income)) : null;
  const expensesPct = prev ? changePct(lastExpenses, Number(prev.expenses)) : null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">Cash Flow</h2>
        <span className="text-xs text-zinc-400">{props.months ?? 12} months</span>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Chart */}
        <div className="min-w-0 flex-1">
          <div className="h-[220px] w-full sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <ReferenceLine y={0} stroke="#d4d4d8" strokeWidth={1} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickFormatter={(v: number) => fmt(Math.abs(v))}
                  width={64}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [fmtFull(Math.abs(v)), name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="income" name="Income" fill="#0F4B45" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#22C55E" radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side panel */}
        <div className="flex shrink-0 flex-row gap-6 lg:w-44 lg:flex-col lg:gap-5 lg:pt-1">
          <SideStat
            label="Income"
            amount={lastIncome}
            pct={incomePct}
            positiveIsGood={true}
            iconBg="bg-teal-800"
            iconPath={
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            }
          />
          <SideStat
            label="Expense"
            amount={lastExpenses}
            pct={expensesPct}
            positiveIsGood={false}
            iconBg="bg-emerald-500"
            iconPath={
              <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
            }
          />
        </div>
      </div>
    </div>
  );
}

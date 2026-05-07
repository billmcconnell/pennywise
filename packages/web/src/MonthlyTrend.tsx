import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyPoint } from './api';

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function MonthlyTrend(props: { data: MonthlyPoint[]; months?: number }) {
  if (props.data.length === 0) {
    return (
      <div className="rounded border border-zinc-200 p-6 text-sm text-zinc-500">
        No monthly data yet.
      </div>
    );
  }

  const series = props.data.map((p) => ({
    month: p.month.slice(2),
    income: Number(p.income),
    expenses: Number(p.expenses),
  }));

  return (
    <div className="rounded border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-medium">Income vs expenses ({props.months ?? 12} months)</h2>
      <div className="h-[220px] w-full sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} width={70} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Bar dataKey="income" fill="#059669" />
            <Bar dataKey="expenses" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

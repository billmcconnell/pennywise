import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryTrendPoint } from './api';
import { CATEGORY_COLORS } from './categoryColors';

const COLORS = CATEGORY_COLORS;

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CategoryTrends(props: { data: CategoryTrendPoint[]; months?: number }) {
  const { series, topSlugs, slugNames } = useMemo(() => {
    if (props.data.length === 0) return { series: [], topSlugs: [], slugNames: new Map() };

    const slugTotals = new Map<string, number>();
    const slugNames = new Map<string, string>();
    for (const p of props.data) {
      slugTotals.set(p.slug, (slugTotals.get(p.slug) ?? 0) + Number(p.total));
      slugNames.set(p.slug, p.name);
    }

    const topSlugs = [...slugTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([slug]) => slug);

    const byMonth = new Map<string, Record<string, number>>();
    for (const p of props.data) {
      if (!topSlugs.includes(p.slug)) continue;
      const row = byMonth.get(p.month) ?? {};
      row[p.slug] = (row[p.slug] ?? 0) + Number(p.total);
      byMonth.set(p.month, row);
    }

    const series = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month: month.slice(2), ...vals }));

    return { series, topSlugs, slugNames };
  }, [props.data]);

  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500">
        No category trend data yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h2 className="mb-2 text-base font-semibold text-zinc-900">Category trends ({props.months ?? 12} months)</h2>
      <div className="h-[240px] w-full sm:h-[280px] md:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} width={70} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            {topSlugs.map((slug) => (
              <Line
                key={slug}
                type="monotone"
                dataKey={slug}
                name={slugNames.get(slug) ?? slug}
                stroke={COLORS[slug] ?? '#a1a1aa'}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

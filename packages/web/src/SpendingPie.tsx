import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category, CategoryTotal } from './api';

const COLORS: Record<string, string> = {
  housing: '#2563eb',
  transportation: '#0891b2',
  food: '#16a34a',
  healthcare: '#dc2626',
  personal: '#9333ea',
  financial: '#ca8a04',
  income: '#059669',
  uncategorized: '#71717a',
};

interface PieSlice {
  slug: string;
  name: string;
  total: number;
}

export function SpendingPie(props: { totals: CategoryTotal[]; categories: Category[] }) {
  const slices = useMemo(
    () => rollUpToTopLevel(props.totals, props.categories),
    [props.totals, props.categories],
  );

  if (slices.length === 0) {
    return (
      <div className="rounded border border-zinc-200 p-6 text-sm text-zinc-500">
        No spending to chart for this month.
      </div>
    );
  }

  const grandTotal = slices.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="rounded border border-zinc-200 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Spending by category</h2>
        <span className="text-sm tabular-nums text-zinc-600">
          {grandTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </span>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={1}
            >
              {slices.map((s) => (
                <Cell key={s.slug} fill={COLORS[s.slug] ?? '#a1a1aa'} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) =>
              v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            } />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function rollUpToTopLevel(totals: CategoryTotal[], cats: Category[]): PieSlice[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const buckets = new Map<string, PieSlice>();

  for (const row of totals) {
    const amount = Number(row.total);
    if (!isFinite(amount) || amount <= 0) continue;

    let topSlug: string;
    let topName: string;
    if (row.categoryId === null) {
      topSlug = 'uncategorized';
      topName = 'Uncategorized';
    } else {
      const cat = byId.get(row.categoryId);
      if (!cat) continue;
      const top = cat.parentId ? byId.get(cat.parentId) ?? cat : cat;
      topSlug = top.slug;
      topName = top.name;
    }

    const existing = buckets.get(topSlug);
    if (existing) existing.total += amount;
    else buckets.set(topSlug, { slug: topSlug, name: topName, total: amount });
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category, CategoryTotal } from './api';
import { CATEGORY_COLORS, CATEGORY_PILL } from './categoryColors';

const COLORS = CATEGORY_COLORS;

const SUB_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#38bdf8', '#4ade80', '#e879f9', '#94a3b8',
];

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

interface PieSlice {
  slug: string;
  name: string;
  total: number;
}

export function SpendingPie(props: { totals: CategoryTotal[]; categories: Category[] }) {
  const [drillSlug, setDrillSlug] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(props.categories.map((c) => [c.id, c])),
    [props.categories],
  );

  const topSlices = useMemo(
    () => rollUpToTopLevel(props.totals, byId),
    [props.totals, byId],
  );

  const { subSlices, drillName } = useMemo(() => {
    if (!drillSlug) return { subSlices: null, drillName: null };
    const parent = props.categories.find((c) => c.slug === drillSlug && !c.parentId);
    if (!parent) return { subSlices: null, drillName: null };

    const buckets = new Map<string, PieSlice>();
    for (const row of props.totals) {
      const amount = Number(row.total);
      if (!isFinite(amount) || amount <= 0 || !row.categoryId) continue;
      const cat = byId.get(row.categoryId);
      if (!cat) continue;

      let key: string;
      let label: string;
      if (cat.id === parent.id) {
        key = '__direct__';
        label = `${parent.name} (general)`;
      } else if (cat.parentId === parent.id) {
        key = cat.slug;
        label = cat.name;
      } else {
        continue;
      }

      const ex = buckets.get(key);
      if (ex) ex.total += amount;
      else buckets.set(key, { slug: key, name: label, total: amount });
    }

    const slices = [...buckets.values()].sort((a, b) => b.total - a.total);
    return { subSlices: slices.length > 0 ? slices : null, drillName: parent.name };
  }, [drillSlug, props.totals, props.categories, byId]);

  const isDrilled = drillSlug !== null && subSlices !== null;
  const slices = isDrilled ? subSlices! : topSlices;

  if (slices.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500">
        No spending to chart for this month.
      </div>
    );
  }

  const grandTotal = slices.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          {isDrilled && (
            <button
              type="button"
              onClick={() => setDrillSlug(null)}
              className="text-sm text-zinc-400 hover:text-zinc-700"
            >
              ← All
            </button>
          )}
          {!isDrilled && (
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="shrink-0 text-zinc-400">
              <path d="M21.21 15.89A10 10 0 118 2.83"/>
              <path d="M22 12A10 10 0 0012 2v10z"/>
            </svg>
          )}
          <h2 className="text-base font-semibold text-zinc-900">
            {isDrilled ? drillName : 'Spending by category'}
          </h2>
        </div>
        <span className="text-sm tabular-nums text-zinc-600">{fmt(grandTotal)}</span>
      </div>
      <div className="h-[240px] w-full sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={1}
              onClick={(data: unknown) => {
                if (isDrilled) return;
                const slug = (data as PieSlice).slug;
                if (slug && slug !== 'uncategorized') setDrillSlug(slug);
              }}
              cursor={!isDrilled ? 'pointer' : 'default'}
            >
              {slices.map((s, i) => (
                <Cell
                  key={s.slug}
                  fill={
                    isDrilled
                      ? (SUB_COLORS[i % SUB_COLORS.length] ?? '#a1a1aa')
                      : (COLORS[s.slug] ?? '#a1a1aa')
                  }
                />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {slices.map((s, i) => {
          const pill = !isDrilled
            ? (CATEGORY_PILL[s.slug] ?? { bg: 'bg-zinc-100', text: 'text-zinc-500' })
            : null;
          return pill ? (
            <span
              key={s.slug}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.bg} ${pill.text}`}
            >
              {s.name}
            </span>
          ) : (
            <span
              key={s.slug}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: SUB_COLORS[i % SUB_COLORS.length] }}
              />
              {s.name}
            </span>
          );
        })}
      </div>
      {!isDrilled && (
        <p className="mt-2 text-xs text-zinc-400">Click a slice to drill into subcategories</p>
      )}
    </div>
  );
}

function rollUpToTopLevel(totals: CategoryTotal[], byId: Map<string, Category>): PieSlice[] {
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
      const top = cat.parentId ? (byId.get(cat.parentId) ?? cat) : cat;
      topSlug = top.slug;
      topName = top.name;
    }

    const existing = buckets.get(topSlug);
    if (existing) existing.total += amount;
    else buckets.set(topSlug, { slug: topSlug, name: topName, total: amount });
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

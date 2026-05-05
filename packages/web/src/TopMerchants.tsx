import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MerchantTotal } from './api';

const fmt = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function TopMerchants(props: { data: MerchantTotal[] }) {
  if (props.data.length === 0) {
    return (
      <div className="rounded border border-zinc-200 p-6 text-sm text-zinc-500">
        No merchant data yet.
      </div>
    );
  }

  const rows = props.data.map((m) => ({
    key: truncate(m.key, 28),
    full: m.key,
    total: Number(m.total),
    count: m.count,
  }));

  const height = Math.max(220, rows.length * 28);

  return (
    <div className="rounded border border-zinc-200 p-4">
      <h2 className="mb-2 text-lg font-medium">Top merchants</h2>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
            <YAxis type="category" dataKey="key" width={180} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number, _name, props2) => [
                fmt(v),
                `total (${(props2.payload as { count: number }).count} txns)`,
              ]}
              labelFormatter={(_l, payload) =>
                (payload?.[0]?.payload as { full: string } | undefined)?.full ?? ''
              }
            />
            <Bar dataKey="total" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

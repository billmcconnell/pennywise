import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBudgetHistory, type BudgetHistoryRow } from './api';

const MONTH_OPTIONS = [3, 6, 12] as const;

const monthOptions = (() => {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const out: string[] = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      const mo = `${y}-${String(m).padStart(2, '0')}`;
      if (mo > currentYM) break;
      out.push(mo);
    }
  }
  return out.slice(-24);
})();

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtMoney(s: string): string {
  const n = Number(s);
  if (n === 0) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function cellStyle(pct: number, actual: string): string {
  if (Number(actual) === 0) return 'text-zinc-300';
  if (pct >= 100) return 'bg-red-50 text-red-800';
  if (pct >= 80) return 'bg-amber-50 text-amber-800';
  return 'bg-emerald-50 text-emerald-800';
}

export function BudgetHistory() {
  const [numMonths, setNumMonths] = useState<3 | 6 | 12>(6);
  const [endMonth, setEndMonth] = useState(() => monthOptions[monthOptions.length - 1] ?? '');

  const historyQ = useQuery({
    queryKey: ['budget-history', endMonth, numMonths],
    queryFn: () => fetchBudgetHistory(endMonth, numMonths),
    staleTime: 30 * 1000,
  });

  const rows = historyQ.data ?? [];

  if (!historyQ.isLoading && rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium">Budget history</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Show</span>
          {MONTH_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumMonths(n)}
              className={`rounded px-2 py-0.5 text-sm ${
                numMonths === n
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {n}mo
            </button>
          ))}
          <span className="text-zinc-500">ending</span>
          <select
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {historyQ.isLoading && <p className="text-zinc-500 text-sm">loading…</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
                {rows[0]!.months.map((m) => (
                  <th key={m.month} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {fmtMonth(m.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <HistoryRow key={row.categoryId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100" /> &lt;80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-100" /> 80–99%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-100" /> 100%+
          </span>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: BudgetHistoryRow }) {
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-2 font-medium capitalize">{row.categoryName ?? '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
        {fmtMoney(row.budget)}
      </td>
      {row.months.map((m) => (
        <td
          key={m.month}
          className={`px-3 py-2 text-right tabular-nums ${cellStyle(m.pct, m.actual)}`}
        >
          <div>{fmtMoney(m.actual)}</div>
          {Number(m.actual) > 0 && (
            <div className="text-xs opacity-70">{m.pct}%</div>
          )}
        </td>
      ))}
    </tr>
  );
}

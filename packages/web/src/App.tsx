import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories,
  fetchTransactions,
  patchTransactionCategory,
  type Category,
  type Transaction,
} from './api';

const monthOptions = (() => {
  const out: string[] = [];
  for (let y = 2024; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2024 && m < 12) continue;
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

export function App() {
  const [month, setMonth] = useState<string>('2025-06');
  const qc = useQueryClient();

  const txns = useQuery({
    queryKey: ['transactions', month],
    queryFn: () => fetchTransactions(month),
  });

  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const patch = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      patchTransactionCategory(id, categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions', month] }),
  });

  const categoryOptions = useMemo(() => buildCategoryOptions(cats.data ?? []), [cats.data]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Pennywise</h1>
        <label className="text-sm text-zinc-600">
          Month:{' '}
          <select
            className="rounded border border-zinc-300 px-2 py-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </header>

      {txns.isLoading && <p className="text-zinc-500">loading…</p>}
      {txns.error && <p className="text-red-600">error: {(txns.error as Error).message}</p>}
      {txns.data && (
        <TransactionTable
          rows={txns.data}
          categories={categoryOptions}
          onChange={(id, categoryId) => patch.mutate({ id, categoryId })}
          isPending={patch.isPending}
        />
      )}
    </main>
  );
}

interface CategoryOption {
  id: string;
  label: string;
}

function buildCategoryOptions(cats: Category[]): CategoryOption[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => {
      if (c.parentId) {
        const parent = byId.get(c.parentId);
        return { id: c.id, label: `${parent?.name ?? '?'} › ${c.name}` };
      }
      return { id: c.id, label: c.name };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function TransactionTable(props: {
  rows: Transaction[];
  categories: CategoryOption[];
  onChange: (id: string, categoryId: string | null) => void;
  isPending: boolean;
}) {
  if (props.rows.length === 0) {
    return <p className="text-zinc-500">No transactions for this month.</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 tabular-nums text-zinc-600">{r.transactionDate}</td>
              <td className="px-3 py-2">{r.description}</td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${
                  Number(r.amount) < 0 ? 'text-emerald-700' : 'text-zinc-900'
                }`}
              >
                {fmtMoney(r.amount)}
              </td>
              <td className="px-3 py-2">
                <select
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1"
                  value={r.categoryId ?? ''}
                  disabled={props.isPending}
                  onChange={(e) =>
                    props.onChange(r.id, e.target.value === '' ? null : e.target.value)
                  }
                >
                  <option value="">—</option>
                  {props.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtMoney(s: string): string {
  const n = Number(s);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

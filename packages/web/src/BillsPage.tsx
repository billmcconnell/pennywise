import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBill,
  deleteBill,
  fetchBillsStatus,
  fetchBillSuggestions,
  fetchCategories,
  type BillCreateBody,
  type BillStatus,
  type BillSuggestion,
  type Category,
} from './api';

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

const fmt = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function BillsPage() {
  const [month, setMonth] = useState('2025-06');
  const [showAddForm, setShowAddForm] = useState(false);
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ['bills-status', month],
    queryFn: () => fetchBillsStatus(month),
    staleTime: 30 * 1000,
  });

  const suggestionsQ = useQuery({
    queryKey: ['bill-suggestions', month],
    queryFn: () => fetchBillSuggestions(month),
    staleTime: 2 * 60 * 1000,
  });

  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: createBill,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills-status'] });
      qc.invalidateQueries({ queryKey: ['bill-suggestions'] });
      setShowAddForm(false);
    },
  });

  const remove = useMutation({
    mutationFn: deleteBill,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills-status'] }),
  });

  const bills = statusQ.data ?? [];
  const paid = bills.filter((b) => b.paid).length;
  const total = bills.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-600">
          Month:{' '}
          <select
            className="rounded-xl border border-zinc-300 px-2 py-1"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        {total > 0 && (
          <span className="text-sm text-zinc-500">
            {paid}/{total} paid
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className={`rounded px-3 py-1 text-sm ${showAddForm ? 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
        >
          {showAddForm ? 'Cancel' : '+ Add bill'}
        </button>
      </div>

      {/* Add bill form */}
      {showAddForm && (
        <AddBillForm
          categories={buildCategoryOptions(catsQ.data ?? [])}
          onSubmit={(body) => create.mutate(body)}
          isPending={create.isPending}
          error={create.error as Error | null}
        />
      )}

      {/* Bill status list */}
      {statusQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {!statusQ.isLoading && bills.length === 0 && (
        <p className="text-zinc-500">No tracked bills yet. Add one above or track a suggestion below.</p>
      )}
      {bills.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {bills.map((b) => (
            <BillRow
              key={b.id}
              bill={b}
              onDelete={() => {
                if (confirm(`Stop tracking "${b.name}"?`)) remove.mutate(b.id);
              }}
              isPending={remove.isPending}
            />
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestionsQ.isError && (
        <p className="text-sm text-red-600">Failed to load bill suggestions.</p>
      )}
      {suggestionsQ.data && suggestionsQ.data.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestionsQ.data}
          categories={catsQ.data ?? []}
          onTrack={(body) => create.mutate(body)}
          isPending={create.isPending}
        />
      )}
    </div>
  );
}

function BillRow({
  bill,
  onDelete,
  isPending,
}: {
  bill: BillStatus;
  onDelete: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-sm">{bill.name}</span>
          {bill.dueDay && (
            <span className="text-xs text-zinc-400">due ~{bill.dueDay}{ordinal(bill.dueDay)}</span>
          )}
          {bill.expectedAmount && (
            <span className="text-xs text-zinc-500">{fmt(bill.expectedAmount)}/mo</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-zinc-400 font-mono">{bill.matchPattern}</div>
        {bill.paid && bill.paidDate && (
          <div className="mt-0.5 text-xs text-emerald-700">
            {fmt(bill.paidAmount!)} on {bill.paidDate}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {bill.paid ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Paid
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Pending
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function SuggestionsPanel({
  suggestions,
  categories,
  onTrack,
  isPending,
}: {
  suggestions: BillSuggestion[];
  categories: Category[];
  onTrack: (body: BillCreateBody) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-700">
        Suggested from your recurring transactions
      </h3>
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <SuggestionRow
            key={s.pattern}
            suggestion={s}
            categories={categories}
            onTrack={onTrack}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  onTrack,
  isPending,
}: {
  suggestion: BillSuggestion;
  categories: Category[];
  onTrack: (body: BillCreateBody) => void;
  isPending: boolean;
}) {
  const [tracking, setTracking] = useState(false);
  const [name, setName] = useState(capitalize(suggestion.pattern));

  if (tracking) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded bg-zinc-50 p-2 text-sm">
        <input
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bill name"
        />
        <button
          type="button"
          disabled={isPending || !name.trim()}
          onClick={() =>
            onTrack({
              name: name.trim(),
              matchPattern: suggestion.pattern,
              expectedAmount: Number(suggestion.avgAmount).toFixed(2),
            })
          }
          className="rounded bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Track'}
        </button>
        <button
          type="button"
          onClick={() => setTracking(false)}
          className="text-xs text-zinc-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <span className="font-mono text-xs text-zinc-700">{suggestion.pattern}</span>
        <span className="ml-2 text-xs text-zinc-400">
          ~{fmt(Number(suggestion.avgAmount).toFixed(2))}/mo · {suggestion.monthCount} months
        </span>
      </div>
      <button
        type="button"
        onClick={() => setTracking(true)}
        className="shrink-0 rounded-xl border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        Track
      </button>
    </div>
  );
}

function AddBillForm({
  categories,
  onSubmit,
  isPending,
  error,
}: {
  categories: CategoryOption[];
  onSubmit: (body: BillCreateBody) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState('');
  const [matchPattern, setMatchPattern] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dueDay, setDueDay] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !matchPattern.trim()) return;
    const body: BillCreateBody = {
      name: name.trim(),
      matchPattern: matchPattern.trim(),
      expectedAmount: expectedAmount || null,
      categoryId: categoryId || null,
      dueDay: dueDay ? parseInt(dueDay, 10) : null,
    };
    onSubmit(body);
    setName('');
    setMatchPattern('');
    setExpectedAmount('');
    setCategoryId('');
    setDueDay('');
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={handleSubmit}
    >
      <FormField label="Name">
        <input
          required
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Netflix"
        />
      </FormField>
      <FormField label="Match pattern">
        <input
          required
          className="w-full rounded-xl border border-zinc-300 px-2 py-1 text-sm sm:w-48"
          value={matchPattern}
          onChange={(e) => setMatchPattern(e.target.value)}
          placeholder="NETFLIX"
        />
      </FormField>
      <FormField label="Expected amount">
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="w-28 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={expectedAmount}
          onChange={(e) => setExpectedAmount(e.target.value)}
          placeholder="15.99"
        />
      </FormField>
      <FormField label="Category">
        <select
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">— optional —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Due day">
        <input
          type="number"
          min="1"
          max="31"
          className="w-16 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          placeholder="15"
        />
      </FormField>
      <button
        type="submit"
        disabled={isPending || !name.trim() || !matchPattern.trim()}
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Add bill'}
      </button>
      {error && <span className="text-sm text-red-600">{error.message}</span>}
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-600">
      {label}
      {children}
    </label>
  );
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1).toLowerCase();
}

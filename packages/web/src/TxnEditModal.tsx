import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createRule,
  patchTransaction,
  type Transaction,
  type TransactionUpdateBody,
} from './api';

interface CategoryOption {
  id: string;
  label: string;
}

export function TxnEditModal(props: {
  txn: Transaction;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(props.txn.description);
  const [merchant, setMerchant] = useState(props.txn.merchant ?? '');
  const [notes, setNotes] = useState(props.txn.notes ?? '');
  const [tagsInput, setTagsInput] = useState(props.txn.tags.join(', '));
  const [categoryId, setCategoryId] = useState(props.txn.categoryId ?? '');

  const save = useMutation({
    mutationFn: async () => {
      const body: TransactionUpdateBody = {};
      if (description !== props.txn.description) body.description = description;
      const newMerchant = merchant.trim() || null;
      if (newMerchant !== props.txn.merchant) body.merchant = newMerchant;
      const newNotes = notes.trim() || null;
      if (newNotes !== props.txn.notes) body.notes = newNotes;
      const newTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (!arraysEqual(newTags, props.txn.tags)) body.tags = newTags;
      const newCat = categoryId || null;
      if (newCat !== props.txn.categoryId) body.categoryId = newCat;
      if (Object.keys(body).length === 0) return null;
      return patchTransaction(props.txn.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['by-month'] });
      qc.invalidateQueries({ queryKey: ['top-merchants'] });
      props.onClose();
    },
  });

  const saveAsRule = useMutation({
    mutationFn: () => {
      if (!categoryId) throw new Error('Pick a category before saving rule');
      if (!description.trim()) throw new Error('Description required for rule');
      return createRule({
        matchType: 'description_contains',
        pattern: description.trim(),
        categoryId,
        caseInsensitive: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Edit transaction</h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {props.txn.transactionDate} · {fmtMoney(props.txn.amount)}
          </span>
        </header>

        <div className="flex flex-col gap-3 text-sm">
          <Field label="Description">
            <input
              className="rounded border border-zinc-300 px-2 py-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="text-xs text-zinc-500">
            Original: <span className="font-mono">{props.txn.originalDescription}</span>
          </div>
          <Field label="Merchant">
            <input
              className="rounded border border-zinc-300 px-2 py-1"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select
              className="rounded border border-zinc-300 px-2 py-1"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              className="rounded border border-zinc-300 px-2 py-1"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              className="rounded border border-zinc-300 px-2 py-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        {save.error && (
          <p className="mt-3 text-sm text-red-600">{(save.error as Error).message}</p>
        )}
        {saveAsRule.error && (
          <p className="mt-3 text-sm text-red-600">{(saveAsRule.error as Error).message}</p>
        )}
        {saveAsRule.data && (
          <p className="mt-3 text-sm text-emerald-700">
            Rule created. Use “Apply rules” on Rules tab to backfill.
          </p>
        )}

        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={saveAsRule.isPending || !categoryId || !description.trim()}
            onClick={() => saveAsRule.mutate()}
            className="rounded bg-zinc-200 px-3 py-1 text-sm text-zinc-800 disabled:opacity-40"
          >
            {saveAsRule.isPending ? 'Saving rule…' : 'Save as rule'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-600">{props.label}</span>
      {props.children}
    </label>
  );
}

function fmtMoney(s: string): string {
  return Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

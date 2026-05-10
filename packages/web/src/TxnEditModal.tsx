import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyRulesNow,
  createRule,
  fetchTransactionHistory,
  patchTransaction,
  type Transaction,
  type TransactionUpdateBody,
} from './api';

interface CategoryOption {
  id: string;
  label: string;
}

type Step = 'editing' | 'confirm-rule' | 'rule-saved';

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
  const [step, setStep] = useState<Step>('editing');

  const historyQ = useQuery({
    queryKey: ['txn-history', props.txn.id],
    queryFn: () => fetchTransactionHistory(props.txn.id),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['by-category'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
    qc.invalidateQueries({ queryKey: ['by-month'] });
    qc.invalidateQueries({ queryKey: ['top-merchants'] });
    qc.invalidateQueries({ queryKey: ['insights'] });
    qc.invalidateQueries({ queryKey: ['txn-history', props.txn.id] });
  };

  const revert = useMutation({
    mutationFn: () =>
      patchTransaction(props.txn.id, {
        description: props.txn.originalDescription,
        merchant: null,
        notes: null,
        tags: [],
        categoryId: null,
      }),
    onSuccess: () => {
      invalidateAll();
      props.onClose();
    },
  });

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
    onSuccess: (result) => {
      invalidateAll();
      // Category changed and a category is selected — prompt to create a rule
      const categoryChanged = (categoryId || null) !== props.txn.categoryId;
      if (result !== null && categoryChanged && categoryId) {
        setStep('confirm-rule');
      } else {
        props.onClose();
      }
    },
  });

  // Prefer merchant name for rule pattern (more stable than description)
  const rulePattern = merchant.trim() || description.trim();
  const ruleMatchType = merchant.trim() ? 'merchant_contains' : 'description_contains';
  const categoryName = props.categories.find((c) => c.id === categoryId)?.label ?? '';

  const createRuleMutation = useMutation({
    mutationFn: () => {
      if (!categoryId) throw new Error('No category selected');
      return createRule({
        matchType: ruleMatchType,
        pattern: rulePattern,
        categoryId,
        caseInsensitive: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
      setStep('rule-saved');
    },
  });

  const applyRules = useMutation({
    mutationFn: () => applyRulesNow('all_unedited'),
    onSuccess: () => {
      invalidateAll();
      props.onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-3 shadow-xl sm:p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Edit transaction</h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {props.txn.transactionDate} · {fmtMoney(props.txn.amount)}
          </span>
        </header>

        {step === 'confirm-rule' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="mb-1 text-sm font-medium text-blue-900">Create a categorization rule?</p>
              <p className="text-sm text-blue-700">
                Automatically categorize future{' '}
                <span className="font-medium">"{rulePattern}"</span> transactions as{' '}
                <span className="font-medium">{categoryName}</span>.
              </p>
            </div>
            {createRuleMutation.error && (
              <p className="text-sm text-red-600">{(createRuleMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={createRuleMutation.isPending}
                onClick={() => createRuleMutation.mutate()}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createRuleMutation.isPending ? 'Creating…' : 'Yes, create rule'}
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {step === 'rule-saved' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-1 text-sm font-medium text-emerald-900">Rule created.</p>
              <p className="text-sm text-emerald-700">
                Apply it now to re-categorize existing unedited transactions?
              </p>
            </div>
            {applyRules.error && (
              <p className="text-sm text-red-600">{(applyRules.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={applyRules.isPending}
                onClick={() => applyRules.mutate()}
                className="rounded bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {applyRules.isPending ? 'Applying…' : 'Apply to past transactions'}
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {step === 'editing' && (
          <>
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
            {revert.error && (
              <p className="mt-3 text-sm text-red-600">{(revert.error as Error).message}</p>
            )}

            {historyQ.data && historyQ.data.length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Edit history
                </p>
                <ul className="max-h-32 overflow-y-auto space-y-1">
                  {historyQ.data.map((e) => (
                    <li key={e.id} className="text-xs text-zinc-500">
                      <span className="font-medium capitalize text-zinc-700">{e.field}</span>
                      {': '}
                      <span className="line-through">{e.oldValue ?? '—'}</span>
                      {' → '}
                      <span>{e.newValue ?? '—'}</span>
                      <span className="ml-2 text-zinc-400">{fmtRelative(e.editedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={revert.isPending}
                onClick={() => revert.mutate()}
                className="rounded border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
              >
                {revert.isPending ? 'Reverting…' : 'Revert to original'}
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
          </>
        )}
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

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

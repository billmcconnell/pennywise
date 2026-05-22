import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyRulesNow,
  createRule,
  fetchTransactionHistory,
  fetchTransactionSplits,
  patchTransaction,
  putTransactionSplits,
  type SplitInput,
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
  const [splits, setSplits] = useState<SplitInput[]>([]);
  const [splitsLoaded, setSplitsLoaded] = useState(false);

  const splitsQ = useQuery({
    queryKey: ['txn-splits', props.txn.id],
    queryFn: () => fetchTransactionSplits(props.txn.id),
    staleTime: 30 * 1000,
  });

  if (splitsQ.data && !splitsLoaded) {
    setSplits(
      splitsQ.data.map((s) => ({ amount: s.amount, categoryId: s.categoryId, notes: s.notes })),
    );
    setSplitsLoaded(true);
  }

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
    qc.invalidateQueries({ queryKey: ['category-trends'] });
    qc.invalidateQueries({ queryKey: ['txn-history', props.txn.id] });
    qc.invalidateQueries({ queryKey: ['txn-splits', props.txn.id] });
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
      const categoryChanged = (categoryId || null) !== props.txn.categoryId;
      if (result !== null && categoryChanged && categoryId) {
        setStep('confirm-rule');
      } else {
        props.onClose();
      }
    },
  });

  const saveSplits = useMutation({
    mutationFn: () => putTransactionSplits(props.txn.id, splits),
    onSuccess: () => {
      invalidateAll();
      props.onClose();
    },
  });

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

  const hasSplits = splits.length >= 2;
  const txnAmount = Math.abs(Number(props.txn.amount));
  const allocatedAmount = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
  const remaining = txnAmount - allocatedAmount;
  const splitSumOk = Math.abs(remaining) < 0.01;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-3 shadow-xl sm:p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Edit transaction</h2>
          <span className="text-xs text-zinc-500 tabular-nums">
            {props.txn.transactionDate} · {fmtDisplayAmount(props.txn.amount)}
          </span>
        </header>

        {step === 'confirm-rule' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="mb-1 text-sm font-medium text-teal-900">Create a categorization rule?</p>
              <p className="text-sm text-teal-700">
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
                className="rounded bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {createRuleMutation.isPending ? 'Creating…' : 'Yes, create rule'}
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {step === 'rule-saved' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
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
                className="rounded bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {applyRules.isPending ? 'Applying…' : 'Apply to past transactions'}
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
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
                  className="rounded-xl border border-zinc-300 px-2 py-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className="text-xs text-zinc-500">
                Original: <span className="font-mono">{props.txn.originalDescription}</span>
              </div>
              <Field label="Merchant">
                <input
                  className="rounded-xl border border-zinc-300 px-2 py-1"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                />
              </Field>
              {!hasSplits && (
                <Field label="Category">
                  <select
                    className="rounded-xl border border-zinc-300 px-2 py-1"
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
              )}
              <Field label="Tags (comma-separated)">
                <input
                  className="rounded-xl border border-zinc-300 px-2 py-1"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  rows={3}
                  className="rounded-xl border border-zinc-300 px-2 py-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>

            {/* Splits section */}
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Split transaction
                </p>
                {hasSplits && (
                  <button
                    type="button"
                    onClick={() => setSplits([])}
                    className="text-xs text-zinc-400 hover:text-zinc-700"
                  >
                    Remove splits
                  </button>
                )}
              </div>

              {hasSplits ? (
                <div className="flex flex-col gap-2">
                  {splits.map((sp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="w-24 shrink-0 rounded-xl border border-zinc-300 px-2 py-1 text-sm tabular-nums"
                        value={sp.amount}
                        onChange={(e) => {
                          const next = [...splits];
                          next[i] = { ...next[i]!, amount: e.target.value };
                          setSplits(next);
                        }}
                      />
                      <select
                        className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
                        value={sp.categoryId ?? ''}
                        onChange={(e) => {
                          const next = [...splits];
                          next[i] = { ...next[i]!, categoryId: e.target.value || null };
                          setSplits(next);
                        }}
                      >
                        <option value="">—</option>
                        {props.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setSplits(splits.filter((_, j) => j !== i))}
                        className="shrink-0 text-zinc-300 hover:text-rose-500"
                        aria-label="Remove split"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setSplits([...splits, { amount: '', categoryId: null }])}
                    className="mt-1 self-start text-xs text-teal-700 hover:underline"
                  >
                    + Add row
                  </button>

                  <div
                    className={`mt-1 text-xs tabular-nums ${
                      splitSumOk
                        ? 'text-emerald-600'
                        : remaining < 0
                          ? 'text-rose-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {fmtMoney(allocatedAmount.toFixed(2))} allocated
                    {!splitSumOk && (
                      <>
                        {' · '}
                        {remaining > 0
                          ? `${fmtMoney(remaining.toFixed(2))} remaining`
                          : `${fmtMoney(Math.abs(remaining).toFixed(2))} over`}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setSplits([
                      { amount: '', categoryId: null },
                      { amount: '', categoryId: null },
                    ])
                  }
                  className="text-xs text-teal-700 hover:underline"
                >
                  + Split this transaction
                </button>
              )}
            </div>

            {(save.error || saveSplits.error) && (
              <p className="mt-3 text-sm text-red-600">
                {((save.error || saveSplits.error) as Error).message}
              </p>
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
                className="rounded-xl border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
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
                {hasSplits ? (
                  <button
                    type="button"
                    disabled={saveSplits.isPending || !splitSumOk || splits.length < 2}
                    onClick={() => saveSplits.mutate()}
                    className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {saveSplits.isPending ? 'Saving…' : 'Save splits'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={save.isPending}
                    onClick={() => save.mutate()}
                    className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {save.isPending ? 'Saving…' : 'Save'}
                  </button>
                )}
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

// User-facing sign convention: expenses (positive internally) show as -$X, income as +$X.
function fmtDisplayAmount(s: string): string {
  const n = Number(s);
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  if (n > 0) return `-${abs}`;
  if (n < 0) return `+${abs}`;
  return abs;
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

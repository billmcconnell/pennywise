import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  fetchGoals,
  updateGoal,
  type GoalCreateBody,
  type SavingsGoal,
} from './api';

const fmt = (s: string) =>
  Number(s).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function GoalsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const goalsQ = useQuery({
    queryKey: ['goals'],
    queryFn: fetchGoals,
    staleTime: 30 * 1000,
  });

  const create = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setShowAdd(false);
    },
  });

  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  const contribute = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) =>
      contributeToGoal(id, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<GoalCreateBody> }) =>
      updateGoal(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  const goals = goalsQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-zinc-900">Savings goals</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={`rounded px-3 py-1 text-sm ${showAdd ? 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
        >
          {showAdd ? 'Cancel' : '+ New goal'}
        </button>
      </div>

      {showAdd && (
        <GoalForm
          onSubmit={(body) => create.mutate(body)}
          isPending={create.isPending}
          error={create.error as Error | null}
        />
      )}

      {goalsQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {!goalsQ.isLoading && goals.length === 0 && !showAdd && (
        <p className="text-zinc-500">No goals yet. Add one to start tracking your savings.</p>
      )}

      <div className="flex flex-col gap-4">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            onContribute={(amount) => contribute.mutate({ id: g.id, amount })}
            onEdit={(body) => edit.mutate({ id: g.id, body })}
            onDelete={() => {
              if (confirm(`Delete "${g.name}"?`)) remove.mutate(g.id);
            }}
            isPending={contribute.isPending || edit.isPending || remove.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onContribute,
  onEdit,
  onDelete,
  isPending,
}: {
  goal: SavingsGoal;
  onContribute: (amount: string) => void;
  onEdit: (body: Partial<GoalCreateBody>) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [contributionInput, setContributionInput] = useState('');
  const [editing, setEditing] = useState(false);

  const barColor =
    goal.onTrack === false
      ? 'bg-amber-400'
      : goal.pct >= 100
        ? 'bg-emerald-500'
        : 'bg-teal-500';

  function submitContribution(e: React.FormEvent) {
    e.preventDefault();
    if (!contributionInput) return;
    onContribute(contributionInput);
    setContributionInput('');
  }

  if (editing) {
    return (
      <GoalForm
        initial={goal}
        onSubmit={(body) => {
          onEdit(body);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        isPending={isPending}
        error={null}
      />
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">{goal.name}</h3>
          {goal.notes && <p className="mt-0.5 text-xs text-zinc-500">{goal.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-zinc-400 hover:text-zinc-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-1 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(goal.pct, 100)}%` }}
        />
      </div>

      {/* Numbers row */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums">
          <span className="font-semibold">{fmt(goal.currentAmount)}</span>
          <span className="text-zinc-400"> / {fmt(goal.targetAmount)}</span>
        </span>
        <span className="tabular-nums text-zinc-500">{goal.pct}% complete</span>
      </div>

      {/* Status badges */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {goal.pct >= 100 ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
            Goal reached!
          </span>
        ) : (
          <span className="text-zinc-500">{fmt(goal.remaining)} to go</span>
        )}
        {goal.daysRemaining !== null && goal.daysRemaining > 0 && (
          <span className="text-zinc-500">{goal.daysRemaining} days left</span>
        )}
        {goal.daysRemaining !== null && goal.daysRemaining <= 0 && goal.pct < 100 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            Past due
          </span>
        )}
        {goal.onTrack === true && goal.pct < 100 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
            On track
          </span>
        )}
        {goal.onTrack === false && goal.pct < 100 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
            Behind
          </span>
        )}
        {goal.targetDate && (
          <span className="text-zinc-400">Target: {goal.targetDate}</span>
        )}
      </div>

      {/* Contribution form */}
      {goal.pct < 100 && (
        <form onSubmit={submitContribution} className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Add amount"
            className="w-36 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
            value={contributionInput}
            onChange={(e) => setContributionInput(e.target.value)}
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !contributionInput}
            className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

function GoalForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  initial?: SavingsGoal;
  onSubmit: (body: GoalCreateBody) => void;
  onCancel?: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(initial?.targetAmount ?? '');
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    onSubmit({
      name: name.trim(),
      targetAmount,
      targetDate: targetDate || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={handleSubmit}
    >
      <FormField label="Goal name">
        <input
          required
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Emergency fund"
        />
      </FormField>
      <FormField label="Target amount">
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          className="w-32 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="5000"
        />
      </FormField>
      <FormField label="Target date">
        <input
          type="date"
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </FormField>
      <FormField label="Notes">
        <input
          className="w-48 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </FormField>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !name.trim() || !targetAmount}
          className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : initial ? 'Save' : 'Create goal'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        )}
      </div>
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

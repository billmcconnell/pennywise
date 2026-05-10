import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings, type HouseholdSettings } from './api';

export function SettingsPage() {
  const qc = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setShowSuccess(true);
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const id = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(id);
  }, [showSuccess]);

  if (settingsQ.isLoading) return <p className="text-zinc-500">Loading…</p>;
  if (!settingsQ.data) return null;

  return (
    <SettingsForm
      initial={settingsQ.data}
      isPending={save.isPending}
      error={save.error as Error | null}
      success={showSuccess}
      onSave={(patch) => save.mutate(patch)}
    />
  );
}

function SettingsForm(props: {
  initial: HouseholdSettings;
  isPending: boolean;
  error: Error | null;
  success: boolean;
  onSave: (patch: Partial<HouseholdSettings>) => void;
}) {
  const [defaultPeriod, setDefaultPeriod] = useState<HouseholdSettings['defaultPeriod']>(
    props.initial.defaultPeriod,
  );
  const [chartMonths, setChartMonths] = useState<HouseholdSettings['chartMonths']>(
    props.initial.chartMonths,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    props.onSave({ defaultPeriod, chartMonths });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4 rounded border border-zinc-200 bg-zinc-50 p-4 sm:max-w-md"
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-medium">Preferences</h2>

        <Field label="Default dashboard month">
          <select
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
            value={defaultPeriod}
            onChange={(e) => setDefaultPeriod(e.target.value as HouseholdSettings['defaultPeriod'])}
          >
            <option value="latest_data">Most recent month with data</option>
            <option value="current">Current calendar month</option>
            <option value="previous">Previous calendar month</option>
          </select>
        </Field>

        <Field label="Trend chart range">
          <select
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
            value={chartMonths}
            onChange={(e) =>
              setChartMonths(Number(e.target.value) as HouseholdSettings['chartMonths'])
            }
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={props.isPending}
            className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {props.isPending ? 'Saving…' : 'Save preferences'}
          </button>
          {props.success && <span className="text-sm text-emerald-700">Saved.</span>}
          {props.error && (
            <span className="text-sm text-red-600">{props.error.message}</span>
          )}
        </div>
      </form>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{props.label}</span>
      {props.children}
    </label>
  );
}

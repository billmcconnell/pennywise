import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInvite,
  fetchInvites,
  fetchMembers,
  fetchSettings,
  removeMember,
  revokeInvite,
  updateSettings,
  type HouseholdSettings,
} from './api';

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
    <div className="flex flex-col gap-8">
      <SettingsForm
        initial={settingsQ.data}
        isPending={save.isPending}
        error={save.error as Error | null}
        success={showSuccess}
        onSave={(patch) => save.mutate(patch)}
      />
      <MembersSection />
    </div>
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
  );
}

function MembersSection() {
  const qc = useQueryClient();
  const membersQ = useQuery({ queryKey: ['household-members'], queryFn: fetchMembers });
  const invitesQ = useQuery({ queryKey: ['household-invites'], queryFn: fetchInvites });

  const removeM = useMutation({
    mutationFn: removeMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-members'] }),
  });

  const revokeM = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-invites'] }),
  });

  return (
    <div className="flex flex-col gap-6 sm:max-w-md">
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="mb-3 text-lg font-medium">Members</h2>
        {membersQ.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {membersQ.data && membersQ.data.length === 0 && (
          <p className="text-sm text-zinc-500">No members yet.</p>
        )}
        {membersQ.data && membersQ.data.length > 0 && (
          <ul className="divide-y divide-zinc-200">
            {membersQ.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{m.email}</p>
                  <p className="text-xs text-zinc-400">
                    Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${m.email} from this household?`)) {
                      removeM.mutate(m.id);
                    }
                  }}
                  disabled={removeM.isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {removeM.error && (
          <p className="mt-2 text-xs text-red-600">{(removeM.error as Error).message}</p>
        )}
      </div>

      <InviteForm
        onCreated={() => qc.invalidateQueries({ queryKey: ['household-invites'] })}
      />

      {invitesQ.data && invitesQ.data.length > 0 && (
        <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-3 text-base font-medium">Pending invites</h2>
          <ul className="divide-y divide-zinc-200">
            {invitesQ.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{inv.invitedEmail}</p>
                  <p className="text-xs text-zinc-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeM.mutate(inv.id)}
                  disabled={revokeM.isPending}
                  className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-40"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InviteForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const invite = useMutation({
    mutationFn: (e: string) => createInvite(e),
    onSuccess: (data) => {
      const url = `${window.location.origin}/api/auth/accept-invite?token=${data.token}`;
      setInviteUrl(url);
      setEmail('');
      onCreated();
    },
  });

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteUrl(null);
    invite.mutate(email.trim());
  }

  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="mb-3 text-base font-medium">Invite someone</h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="email"
          required
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={invite.isPending || !email.trim()}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {invite.isPending ? 'Creating…' : 'Create link'}
        </button>
      </form>
      {invite.error && (
        <p className="mt-2 text-xs text-red-600">{(invite.error as Error).message}</p>
      )}
      {inviteUrl && (
        <div className="mt-3 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-zinc-700">{inviteUrl}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-zinc-400">Link expires in 7 days. Single use.</p>
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

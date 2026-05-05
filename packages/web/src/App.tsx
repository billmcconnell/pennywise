import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAccount,
  createAccount,
  fetchAccounts,
  fetchByCategory,
  fetchCategories,
  fetchTransactions,
  patchTransactionCategory,
  updateAccount,
  uploadCsv,
  type Account,
  type AccountCreateBody,
  type AccountType,
  type Category,
  type Transaction,
} from './api';
import { SpendingPie } from './SpendingPie';

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

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
];

type View = 'dashboard' | 'accounts';

export function App() {
  const [view, setView] = useState<View>('dashboard');
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Pennywise</h1>
        <nav className="flex gap-2 text-sm">
          <TabButton active={view === 'dashboard'} onClick={() => setView('dashboard')}>
            Dashboard
          </TabButton>
          <TabButton active={view === 'accounts'} onClick={() => setView('accounts')}>
            Accounts
          </TabButton>
        </nav>
      </header>
      {view === 'dashboard' ? <Dashboard /> : <AccountsPage />}
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded px-3 py-1 ${
        props.active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
      }`}
    >
      {props.children}
    </button>
  );
}

function Dashboard() {
  const [month, setMonth] = useState<string>('2025-06');
  const [accountId, setAccountId] = useState<string>('');
  const qc = useQueryClient();

  const accountsQ = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts(false) });

  const txns = useQuery({
    queryKey: ['transactions', month, accountId],
    queryFn: () => fetchTransactions(month, accountId || undefined),
  });

  const cats = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const byCat = useQuery({
    queryKey: ['by-category', month, accountId],
    queryFn: () => fetchByCategory(month, accountId || undefined),
  });

  const patch = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      patchTransactionCategory(id, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
    },
  });

  const categoryOptions = useMemo(() => buildCategoryOptions(cats.data ?? []), [cats.data]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
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
        <label className="text-sm text-zinc-600">
          Account:{' '}
          <select
            className="rounded border border-zinc-300 px-2 py-1"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">All accounts</option>
            {(accountsQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <UploadForm accounts={accountsQ.data ?? []} />

      {byCat.data && cats.data && <SpendingPie totals={byCat.data} categories={cats.data} />}

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
    </>
  );
}

function UploadForm(props: { accounts: Account[] }) {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: () => {
      if (!accountId || !file) throw new Error('account + file required');
      return uploadCsv(accountId, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setFile(null);
    },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        upload.mutate();
      }}
    >
      <label className="text-sm text-zinc-700">
        Import CSV to:{' '}
        <select
          required
          className="rounded border border-zinc-300 px-2 py-1"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">— choose account —</option>
          {props.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm"
      />
      <button
        type="submit"
        disabled={!accountId || !file || upload.isPending}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {upload.isPending ? 'Uploading…' : 'Upload'}
      </button>
      {upload.data && (
        <span className="text-sm text-emerald-700">
          parsed {upload.data.parsed} · inserted {upload.data.inserted} · skipped{' '}
          {upload.data.skipped}
        </span>
      )}
      {upload.error && (
        <span className="text-sm text-red-600">{(upload.error as Error).message}</span>
      )}
    </form>
  );
}

function AccountsPage() {
  const qc = useQueryClient();
  const accountsQ = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => fetchAccounts(true),
  });
  const create = useMutation({
    mutationFn: createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; type: AccountType }) =>
      updateAccount(id, { name: body.name, type: body.type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
  const archive = useMutation({
    mutationFn: archiveAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <NewAccountForm onSubmit={(body) => create.mutate(body)} isPending={create.isPending} />
      {create.error && (
        <p className="text-sm text-red-600">{(create.error as Error).message}</p>
      )}
      {accountsQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {accountsQ.data && (
        <AccountsTable
          rows={accountsQ.data}
          onRename={(id, name, type) => update.mutate({ id, name, type })}
          onArchive={(id) => archive.mutate(id)}
          isPending={update.isPending || archive.isPending}
        />
      )}
    </div>
  );
}

function NewAccountForm(props: {
  onSubmit: (body: AccountCreateBody) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('credit_card');
  const [institution, setInstitution] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name) return;
        const body: AccountCreateBody = { name, type };
        if (institution) body.institution = institution;
        if (lastFour) body.lastFour = lastFour;
        if (openingBalance) body.openingBalance = openingBalance;
        props.onSubmit(body);
        setName('');
        setInstitution('');
        setLastFour('');
        setOpeningBalance('');
      }}
    >
      <Field label="Name">
        <input
          required
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Type">
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Institution">
        <input
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
      </Field>
      <Field label="Last 4">
        <input
          pattern="\d{4}"
          maxLength={4}
          className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={lastFour}
          onChange={(e) => setLastFour(e.target.value)}
        />
      </Field>
      <Field label="Opening balance">
        <input
          inputMode="decimal"
          placeholder="0.00"
          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={props.isPending}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Add account
      </button>
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-600">
      {props.label}
      {props.children}
    </label>
  );
}

function AccountsTable(props: {
  rows: Account[];
  onRename: (id: string, name: string, type: AccountType) => void;
  onArchive: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Institution</th>
            <th className="px-3 py-2 text-right font-medium">Opening</th>
            <th className="px-3 py-2 text-right font-medium">Current</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {props.rows.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              onRename={props.onRename}
              onArchive={props.onArchive}
              isPending={props.isPending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountRow(props: {
  account: Account;
  onRename: (id: string, name: string, type: AccountType) => void;
  onArchive: (id: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(props.account.name);
  const [type, setType] = useState<AccountType>(props.account.type);
  const archived = props.account.archivedAt !== null;
  const dirty = name !== props.account.name || type !== props.account.type;

  return (
    <tr className={`border-t border-zinc-100 ${archived ? 'text-zinc-400' : ''}`}>
      <td className="px-3 py-2">
        <input
          className="w-full rounded border border-zinc-300 px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={archived}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="rounded border border-zinc-300 px-2 py-1"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          disabled={archived}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-zinc-600">{props.account.institution ?? '—'}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmtMoney(props.account.openingBalance)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmtMoney(props.account.currentBalance)}
      </td>
      <td className="px-3 py-2">{archived ? 'Archived' : 'Active'}</td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || archived || props.isPending}
            onClick={() => props.onRename(props.account.id, name, type)}
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-40"
          >
            Save
          </button>
          {!archived && (
            <button
              type="button"
              disabled={props.isPending}
              onClick={() => {
                if (confirm(`Archive "${props.account.name}"? Transactions kept.`)) {
                  props.onArchive(props.account.id);
                }
              }}
              className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 disabled:opacity-40"
            >
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
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
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100">
              <td className="px-3 py-2 tabular-nums text-zinc-600">{r.transactionDate}</td>
              <td className="px-3 py-2 text-zinc-600">{r.accountName ?? '—'}</td>
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

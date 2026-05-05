import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyRulesNow,
  archiveAccount,
  createAccount,
  createRule,
  deleteRule,
  fetchAccounts,
  fetchByCategory,
  fetchByMonth,
  fetchCategories,
  fetchRules,
  fetchSummary,
  fetchTopMerchants,
  fetchTransactions,
  patchTransactionCategory,
  updateAccount,
  updateRule,
  uploadCsv,
  type Account,
  type AccountCreateBody,
  type AccountType,
  type Category,
  type Rule,
  type RuleApplyScope,
  type RuleCreateBody,
  type RuleMatchType,
  type Transaction,
} from './api';
import { SpendingPie } from './SpendingPie';
import { SummaryCards } from './SummaryCards';
import { MonthlyTrend } from './MonthlyTrend';
import { TopMerchants } from './TopMerchants';

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

type View = 'dashboard' | 'accounts' | 'rules';

const MATCH_TYPES: { value: RuleMatchType; label: string }[] = [
  { value: 'merchant_contains', label: 'merchant contains' },
  { value: 'merchant_equals', label: 'merchant equals' },
  { value: 'description_contains', label: 'description contains' },
  { value: 'description_regex', label: 'description regex' },
];

const APPLY_SCOPES: { value: RuleApplyScope; label: string }[] = [
  { value: 'uncategorized', label: 'Uncategorized only' },
  { value: 'auto_categorized', label: 'Previously auto-categorized' },
  { value: 'all_unedited', label: 'All unedited (uncategorized + auto)' },
];

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
          <TabButton active={view === 'rules'} onClick={() => setView('rules')}>
            Rules
          </TabButton>
        </nav>
      </header>
      {view === 'dashboard' && <Dashboard />}
      {view === 'accounts' && <AccountsPage />}
      {view === 'rules' && <RulesPage />}
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

  const summaryQ = useQuery({
    queryKey: ['summary', month, accountId],
    queryFn: () => fetchSummary(month, accountId || undefined),
  });

  const byMonthQ = useQuery({
    queryKey: ['by-month', accountId, month],
    queryFn: () => fetchByMonth(undefined, month, accountId || undefined),
  });

  const topMerchantsQ = useQuery({
    queryKey: ['top-merchants', month, accountId],
    queryFn: () => fetchTopMerchants(month, accountId || undefined, 10),
  });

  const patch = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      patchTransactionCategory(id, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
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

      <SummaryCards summary={summaryQ.data} isLoading={summaryQ.isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byCat.data && cats.data && <SpendingPie totals={byCat.data} categories={cats.data} />}
        {byMonthQ.data && <MonthlyTrend data={byMonthQ.data} />}
      </div>

      {topMerchantsQ.data && <TopMerchants data={topMerchantsQ.data} />}

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
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['by-month'] });
      qc.invalidateQueries({ queryKey: ['top-merchants'] });
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

function RulesPage() {
  const qc = useQueryClient();
  const rulesQ = useQuery({ queryKey: ['rules'], queryFn: fetchRules });
  const catsQ = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const accountsQ = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts(false) });
  const categoryOptions = useMemo(() => buildCategoryOptions(catsQ.data ?? []), [catsQ.data]);

  const create = useMutation({
    mutationFn: createRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<RuleCreateBody>) =>
      updateRule(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
  const remove = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  });
  const apply = useMutation({
    mutationFn: (args: { scope: RuleApplyScope; accountId?: string }) =>
      applyRulesNow(args.scope, args.accountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <NewRuleForm
        categories={categoryOptions}
        onSubmit={(body) => create.mutate(body)}
        isPending={create.isPending}
      />
      {create.error && (
        <p className="text-sm text-red-600">{(create.error as Error).message}</p>
      )}

      <ApplyControls
        accounts={accountsQ.data ?? []}
        onApply={(scope, accountId) => {
          const args: { scope: RuleApplyScope; accountId?: string } = { scope };
          if (accountId) args.accountId = accountId;
          apply.mutate(args);
        }}
        isPending={apply.isPending}
        result={apply.data ?? null}
        error={apply.error as Error | null}
      />

      {rulesQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {rulesQ.data && (
        <RulesTable
          rows={rulesQ.data}
          categories={categoryOptions}
          onUpdate={(id, body) => update.mutate({ id, ...body })}
          onDelete={(id) => remove.mutate(id)}
          isPending={update.isPending || remove.isPending}
        />
      )}
    </div>
  );
}

function NewRuleForm(props: {
  categories: CategoryOption[];
  onSubmit: (body: RuleCreateBody) => void;
  isPending: boolean;
}) {
  const [matchType, setMatchType] = useState<RuleMatchType>('description_contains');
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('0');
  const [caseInsensitive, setCaseInsensitive] = useState(true);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pattern || !categoryId) return;
        const body: RuleCreateBody = { matchType, pattern, categoryId, caseInsensitive };
        const p = parseInt(priority, 10);
        if (!Number.isNaN(p)) body.priority = p;
        props.onSubmit(body);
        setPattern('');
      }}
    >
      <Field label="Match type">
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={matchType}
          onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
        >
          {MATCH_TYPES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Pattern">
        <input
          required
          className="w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
      </Field>
      <Field label="Category">
        <select
          required
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">— choose —</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <input
          type="number"
          className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-1 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={caseInsensitive}
          onChange={(e) => setCaseInsensitive(e.target.checked)}
        />
        case-insensitive
      </label>
      <button
        type="submit"
        disabled={props.isPending}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Add rule
      </button>
    </form>
  );
}

function ApplyControls(props: {
  accounts: Account[];
  onApply: (scope: RuleApplyScope, accountId?: string) => void;
  isPending: boolean;
  result: { scanned: number; matched: number; updated: number } | null;
  error: Error | null;
}) {
  const [scope, setScope] = useState<RuleApplyScope>('uncategorized');
  const [accountId, setAccountId] = useState('');

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
      <Field label="Apply scope">
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={scope}
          onChange={(e) => setScope(e.target.value as RuleApplyScope)}
        >
          {APPLY_SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Account">
        <select
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">All accounts</option>
          {props.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        disabled={props.isPending}
        onClick={() => props.onApply(scope, accountId || undefined)}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {props.isPending ? 'Applying…' : 'Apply rules'}
      </button>
      {props.result && (
        <span className="text-sm text-emerald-700">
          scanned {props.result.scanned} · matched {props.result.matched} · updated{' '}
          {props.result.updated}
        </span>
      )}
      {props.error && <span className="text-sm text-red-600">{props.error.message}</span>}
    </div>
  );
}

function RulesTable(props: {
  rows: Rule[];
  categories: CategoryOption[];
  onUpdate: (id: string, body: Partial<RuleCreateBody>) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  if (props.rows.length === 0) {
    return <p className="text-zinc-500">No rules yet. Add one above.</p>;
  }
  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">Match</th>
            <th className="px-3 py-2 font-medium">Pattern</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Enabled</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              categories={props.categories}
              onUpdate={props.onUpdate}
              onDelete={props.onDelete}
              isPending={props.isPending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow(props: {
  rule: Rule;
  categories: CategoryOption[];
  onUpdate: (id: string, body: Partial<RuleCreateBody>) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-2 text-zinc-600">
        {MATCH_TYPES.find((m) => m.value === props.rule.matchType)?.label ?? props.rule.matchType}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{props.rule.pattern}</td>
      <td className="px-3 py-2">
        <select
          className="rounded border border-zinc-300 px-2 py-1"
          value={props.rule.categoryId}
          disabled={props.isPending}
          onChange={(e) => props.onUpdate(props.rule.id, { categoryId: e.target.value })}
        >
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="w-16 rounded border border-zinc-300 px-2 py-1"
          defaultValue={props.rule.priority}
          disabled={props.isPending}
          onBlur={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n) && n !== props.rule.priority) {
              props.onUpdate(props.rule.id, { priority: n });
            }
          }}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={props.rule.enabled}
          disabled={props.isPending}
          onChange={(e) => props.onUpdate(props.rule.id, { enabled: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          disabled={props.isPending}
          onClick={() => {
            if (confirm('Delete this rule?')) props.onDelete(props.rule.id);
          }}
          className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 disabled:opacity-40"
        >
          Delete
        </button>
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

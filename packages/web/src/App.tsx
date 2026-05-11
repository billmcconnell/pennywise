import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyRulesNow,
  archiveAccount,
  createAccount,
  createRule,
  deleteRule,
  deleteBudget,
  fetchAccounts,
  fetchAvailableMonths,
  fetchBudgets,
  fetchBudgetStatus,
  fetchGoals,
  fetchMe,
  fetchTags,
  fetchByCategory,
  fetchByMonth,
  fetchCategories,
  fetchCategoryTrends,
  fetchInsights,
  fetchRules,
  fetchSettings,
  fetchSummary,
  fetchTopMerchants,
  fetchTransactions,
  logout,
  patchTransactionCategory,
  updateAccount,
  updateRule,
  upsertBudget,
  uploadCsv,
  type Account,
  type AccountCreateBody,
  type AccountType,
  type Budget,
  type Category,
  type Rule,
  type RuleApplyScope,
  type RuleCreateBody,
  type RuleMatchType,
  type Transaction,
} from './api';
import { LoginPage } from './LoginPage';
import { BudgetStatusPanel } from './BudgetStatus';
import { NetWorthPanel } from './NetWorthPanel';
import { SettingsPage } from './SettingsPage';
import { BudgetHistory } from './BudgetHistory';
import { BillsPage } from './BillsPage';
import { GoalsPage } from './GoalsPage';
import { GoalsPanel } from './GoalsPanel';
import { CategoryTrends } from './CategoryTrends';
import { InsightCards } from './InsightCards';
import { SpendingPie } from './SpendingPie';
import { SummaryCards } from './SummaryCards';
import { MonthlyTrend } from './MonthlyTrend';
import { TopMerchants } from './TopMerchants';
import { TxnEditModal } from './TxnEditModal';
import { CategoriesPage } from './CategoriesPage';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'investment', label: 'Investment' },
];

type View = 'dashboard' | 'accounts' | 'budgets' | 'goals' | 'bills' | 'rules' | 'categories' | 'settings';

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

const PAGE_SIZE = 50;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function clientAddMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function App() {
  const queryClient = useQueryClient();
  const authQuery = useQuery({ queryKey: ['auth/me'], queryFn: fetchMe, retry: false });

  async function handleLogout() {
    await logout();
    queryClient.clear();
    await authQuery.refetch();
  }

  if (authQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (authQuery.data === null) {
    return <LoginPage />;
  }

  return <AppShell onLogout={handleLogout} showLogout={!!authQuery.data?.user} />;
}

const MORE_VIEWS: View[] = ['goals', 'bills', 'rules', 'categories'];

function AppShell({ onLogout, showLogout }: { onLogout: () => void; showLogout: boolean }) {
  const [view, setView] = useState<View>('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_VIEWS.includes(view);

  function navigate(v: View) {
    setView(v);
    setMoreOpen(false);
  }

  return (
    <>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-3 pb-24 sm:p-6 md:pb-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold sm:text-2xl">Pennywise</h1>
          <nav className="hidden gap-2 text-sm md:flex">
            <TabButton active={view === 'dashboard'} onClick={() => navigate('dashboard')}>Dashboard</TabButton>
            <TabButton active={view === 'accounts'} onClick={() => navigate('accounts')}>Accounts</TabButton>
            <TabButton active={view === 'budgets'} onClick={() => navigate('budgets')}>Budgets</TabButton>
            <TabButton active={view === 'goals'} onClick={() => navigate('goals')}>Goals</TabButton>
            <TabButton active={view === 'bills'} onClick={() => navigate('bills')}>Bills</TabButton>
            <TabButton active={view === 'rules'} onClick={() => navigate('rules')}>Rules</TabButton>
            <TabButton active={view === 'categories'} onClick={() => navigate('categories')}>Categories</TabButton>
            <TabButton active={view === 'settings'} onClick={() => navigate('settings')}>Settings</TabButton>
            {showLogout && (
              <button onClick={onLogout} className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
                Sign out
              </button>
            )}
          </nav>
        </header>
        {view === 'dashboard' && <Dashboard />}
        {view === 'accounts' && <AccountsPage />}
        {view === 'budgets' && <BudgetsPage />}
        {view === 'goals' && <GoalsPage />}
        {view === 'bills' && <BillsPage />}
        {view === 'rules' && <RulesPage />}
        {view === 'categories' && <CategoriesPage />}
        {view === 'settings' && <SettingsPage />}
      </main>

      {/* Mobile bottom nav — 4 primary + More */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white md:hidden">
        <div className="flex">
          <BottomNavButton active={view === 'dashboard'} onClick={() => navigate('dashboard')} label="Dashboard"><IconHome /></BottomNavButton>
          <BottomNavButton active={view === 'accounts'} onClick={() => navigate('accounts')} label="Accounts"><IconCard /></BottomNavButton>
          <BottomNavButton active={view === 'budgets'} onClick={() => navigate('budgets')} label="Budgets"><IconBars /></BottomNavButton>
          <BottomNavButton active={view === 'settings'} onClick={() => navigate('settings')} label="Settings"><IconCog /></BottomNavButton>
          <BottomNavButton active={isMoreActive || moreOpen} onClick={() => setMoreOpen((o) => !o)} label="More"><IconEllipsis /></BottomNavButton>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-14 left-0 right-0 z-50 rounded-t-2xl border-t border-zinc-200 bg-white shadow-xl md:hidden">
            <div className="flex flex-col py-1">
              {MORE_VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => navigate(v)}
                  className={`px-6 py-3.5 text-left text-sm capitalize ${
                    view === v ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-700 active:bg-zinc-50'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
              {showLogout && (
                <button
                  onClick={() => { setMoreOpen(false); onLogout(); }}
                  className="mt-1 border-t border-zinc-100 px-6 py-3.5 text-left text-sm text-zinc-500 active:bg-zinc-50"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
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

function BottomNavButton(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
        props.active ? 'text-zinc-900' : 'text-zinc-400 active:text-zinc-600'
      }`}
    >
      {props.children}
      <span className="text-[10px] leading-tight">{props.label}</span>
    </button>
  );
}

function IconHome() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm5.25-.75a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" />
    </svg>
  );
}

function IconBars() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M12 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2zM6.5 8a1 1 0 00-1 1v7a1 1 0 001 1h2a1 1 0 001-1V9a1 1 0 00-1-1h-2zM2 13a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3z" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

function IconEllipsis() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}

function Dashboard() {
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [accountId, setAccountId] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const search = useDebounce(searchInput, 300);
  const [tag, setTag] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const qc = useQueryClient();

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccounts(false),
    staleTime: 2 * 60 * 1000,
  });

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const availableMonthsQ = useQuery({
    queryKey: ['available-months'],
    queryFn: fetchAvailableMonths,
    staleTime: 5 * 60 * 1000,
  });

  const tagsQ = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 2 * 60 * 1000,
  });

  const hasAppliedDefault = useRef(false);
  useEffect(() => {
    if (hasAppliedDefault.current) return;
    if (!settingsQ.data || !availableMonthsQ.data) return;
    hasAppliedDefault.current = true;

    const { defaultPeriod } = settingsQ.data;
    const now = new Date().toISOString().slice(0, 7);

    if (defaultPeriod === 'current') {
      setMonth(now);
    } else if (defaultPeriod === 'previous') {
      setMonth(clientAddMonths(now, -1));
    } else {
      const latest = availableMonthsQ.data[0];
      if (latest) setMonth(latest);
    }
  }, [settingsQ.data, availableMonthsQ.data]);

  const txnsQ = useInfiniteQuery({
    queryKey: ['transactions', month, accountId, search, tag, categoryFilter],
    queryFn: ({ pageParam }) =>
      fetchTransactions(month, accountId || undefined, search || undefined, pageParam, tag || undefined, categoryFilter || undefined),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined,
    staleTime: 30 * 1000,
  });

  const allTxns = useMemo(
    () => txnsQ.data?.pages.flatMap((p) => p.rows) ?? [],
    [txnsQ.data],
  );
  const txnTotal = txnsQ.data?.pages[0]?.total ?? 0;
  const hasMore = txnsQ.data?.pages.at(-1)?.hasMore ?? false;

  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  const byCat = useQuery({
    queryKey: ['by-category', month, accountId],
    queryFn: () => fetchByCategory(month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const summaryQ = useQuery({
    queryKey: ['summary', month, accountId],
    queryFn: () => fetchSummary(month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const chartMonths = settingsQ.data?.chartMonths ?? 12;
  const fromMonth = clientAddMonths(month, -(chartMonths - 1));
  const monthOptions = availableMonthsQ.data ?? [];

  const byMonthQ = useQuery({
    queryKey: ['by-month', accountId, month, chartMonths],
    queryFn: () => fetchByMonth(fromMonth, month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const topMerchantsQ = useQuery({
    queryKey: ['top-merchants', month, accountId],
    queryFn: () => fetchTopMerchants(month, accountId || undefined, 10),
    staleTime: 30 * 1000,
  });

  const categoryTrendsQ = useQuery({
    queryKey: ['category-trends', accountId, month, chartMonths],
    queryFn: () => fetchCategoryTrends(fromMonth, month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const insightsQ = useQuery({
    queryKey: ['insights', month, accountId],
    queryFn: () => fetchInsights(month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const budgetStatusQ = useQuery({
    queryKey: ['budget-status', month, accountId],
    queryFn: () => fetchBudgetStatus(month, accountId || undefined),
    staleTime: 30 * 1000,
  });

  const goalsQ = useQuery({
    queryKey: ['goals'],
    queryFn: fetchGoals,
    staleTime: 30 * 1000,
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

  const csvHref = useMemo(() => {
    const p = new URLSearchParams({ month });
    if (accountId) p.set('accountId', accountId);
    if (search) p.set('q', search);
    if (tag) p.set('tag', tag);
    if (categoryFilter) p.set('categoryId', categoryFilter);
    return `/api/exports/transactions.csv?${p.toString()}`;
  }, [month, accountId, search, tag, categoryFilter]);

  const activeFilterCount = (tag ? 1 : 0) + (categoryFilter ? 1 : 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Row 1: Month + Account + Filters toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-zinc-600">
            <span className="shrink-0">Month</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm text-zinc-600">
            <span className="shrink-0">Account</span>
            <select
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">All</option>
              {(accountsQ.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`ml-auto rounded border px-2.5 py-1 text-sm transition-colors ${
              activeFilterCount > 0
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {/* Row 2: Search — always visible */}
        <input
          type="search"
          placeholder="Search description / merchant"
          className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        {/* Row 3: Extra filters + export — collapsible */}
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 p-2">
            {(tagsQ.data ?? []).length > 0 && (
              <label className="flex items-center gap-1 text-xs text-zinc-600">
                <span>Tag</span>
                <select
                  className="rounded border border-zinc-300 px-2 py-1 text-xs"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">All tags</option>
                  {(tagsQ.data ?? []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1 text-xs text-zinc-600">
              <span>Category</span>
              <select
                className="rounded border border-zinc-300 px-2 py-1 text-xs"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                <option value="none">Uncategorized</option>
                {(cats.data ?? [])
                  .filter((c) => c.parentId === null && c.name.toLowerCase() !== 'uncategorized')
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </label>
            <div className="ml-auto flex gap-2">
              <a href={csvHref} className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100">
                Export CSV
              </a>
              <a href="/api/exports/backup.json" className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100">
                Backup
              </a>
            </div>
          </div>
        )}
      </div>

      <UploadForm accounts={accountsQ.data ?? []} />

      <SummaryCards summary={summaryQ.data} isLoading={summaryQ.isLoading} />

      {insightsQ.data && <InsightCards data={insightsQ.data} />}

      {budgetStatusQ.data && budgetStatusQ.data.length > 0 && (
        <BudgetStatusPanel data={budgetStatusQ.data} />
      )}

      {goalsQ.data && goalsQ.data.length > 0 && (
        <GoalsPanel goals={goalsQ.data} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byCat.data && cats.data && <SpendingPie totals={byCat.data} categories={cats.data} />}
        {byMonthQ.data && <MonthlyTrend data={byMonthQ.data} months={chartMonths} />}
      </div>

      {topMerchantsQ.data && <TopMerchants data={topMerchantsQ.data} />}

      {categoryTrendsQ.data && <CategoryTrends data={categoryTrendsQ.data} months={chartMonths} />}

      {txnsQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {txnsQ.error && <p className="text-red-600">error: {(txnsQ.error as Error).message}</p>}
      {allTxns.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing {allTxns.length} of {txnTotal} transactions
            </span>
          </div>
          <TransactionTable
            rows={allTxns}
            categories={categoryOptions}
            onChange={(id, categoryId) => patch.mutate({ id, categoryId })}
            onEdit={(t) => setEditingTxn(t)}
            isPending={patch.isPending}
          />
          {hasMore && (
            <button
              type="button"
              onClick={() => txnsQ.fetchNextPage()}
              disabled={txnsQ.isFetchingNextPage}
              className="w-full rounded border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {txnsQ.isFetchingNextPage ? 'Loading…' : `Load more (${txnTotal - allTxns.length} remaining)`}
            </button>
          )}
        </>
      )}
      {!txnsQ.isLoading && allTxns.length === 0 && (
        <p className="text-zinc-500">No transactions match.</p>
      )}
      {editingTxn && (
        <TxnEditModal
          txn={editingTxn}
          categories={categoryOptions}
          onClose={() => setEditingTxn(null)}
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
        Import CSV / OFX / QFX to:{' '}
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
        accept=".csv,.ofx,.qfx,text/csv"
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
    staleTime: 2 * 60 * 1000,
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
      {accountsQ.data && accountsQ.data.length > 0 && (
        <NetWorthPanel accounts={accountsQ.data} />
      )}
      {accountsQ.data && accountsQ.data.length === 0 && (
        <p className="text-sm text-zinc-500">No accounts yet. Add one above to get started.</p>
      )}
      {accountsQ.data && accountsQ.data.length > 0 && (
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
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Institution</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Opening</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Current</th>
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
      <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">{props.account.institution ?? '—'}</td>
      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
        {fmtMoney(props.account.openingBalance)}
      </td>
      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
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

function BudgetsPage() {
  const qc = useQueryClient();
  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });
  const budgetsQ = useQuery({
    queryKey: ['budgets'],
    queryFn: fetchBudgets,
    staleTime: 2 * 60 * 1000,
  });

  const upsert = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: string; amount: string }) =>
      upsertBudget(categoryId, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['budget-status'] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['budget-status'] });
    },
  });

  // Top-level categories only (no parentId)
  const topLevelCats = useMemo(
    () => (catsQ.data ?? []).filter((c) => c.parentId === null),
    [catsQ.data],
  );
  const budgetedIds = useMemo(
    () => new Set((budgetsQ.data ?? []).map((b) => b.categoryId)),
    [budgetsQ.data],
  );
  const availableCats = useMemo(
    () => topLevelCats.filter((c) => !budgetedIds.has(c.id)),
    [topLevelCats, budgetedIds],
  );

  return (
    <div className="flex flex-col gap-6">
      <NewBudgetForm
        categories={availableCats}
        onSubmit={(categoryId, amount) => upsert.mutate({ categoryId, amount })}
        isPending={upsert.isPending}
        error={upsert.error as Error | null}
      />
      {budgetsQ.isLoading && <p className="text-zinc-500">loading…</p>}
      {budgetsQ.data && budgetsQ.data.length === 0 && (
        <p className="text-zinc-500">No budgets yet. Add one above.</p>
      )}
      {budgetsQ.data && budgetsQ.data.length > 0 && (
        <BudgetsTable
          rows={budgetsQ.data}
          onSave={(categoryId, amount) => upsert.mutate({ categoryId, amount })}
          onDelete={(categoryId) => remove.mutate(categoryId)}
          isPending={upsert.isPending || remove.isPending}
        />
      )}
      {budgetsQ.data && budgetsQ.data.length > 0 && <BudgetHistory />}
    </div>
  );
}

function NewBudgetForm(props: {
  categories: Category[];
  onSubmit: (categoryId: string, amount: string) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !amount) return;
    props.onSubmit(categoryId, amount);
    setCategoryId('');
    setAmount('');
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={handleSubmit}
    >
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
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Monthly budget">
        <input
          required
          type="number"
          min="0.01"
          step="0.01"
          placeholder="500.00"
          className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={props.isPending || !categoryId || !amount}
        className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        {props.isPending ? 'Saving…' : 'Add budget'}
      </button>
      {props.error && (
        <span className="text-sm text-red-600">{props.error.message}</span>
      )}
    </form>
  );
}

function BudgetsTable(props: {
  rows: Budget[];
  onSave: (categoryId: string, amount: string) => void;
  onDelete: (categoryId: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Monthly budget</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {props.rows.map((b) => (
            <BudgetRow
              key={b.categoryId}
              budget={b}
              onSave={props.onSave}
              onDelete={props.onDelete}
              isPending={props.isPending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BudgetRow(props: {
  budget: Budget;
  onSave: (categoryId: string, amount: string) => void;
  onDelete: (categoryId: string) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState(props.budget.amount);
  const dirty = amount !== props.budget.amount;

  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-2 capitalize">{props.budget.categoryName ?? '—'}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={props.isPending}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || props.isPending}
            onClick={() => props.onSave(props.budget.categoryId, amount)}
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={props.isPending}
            onClick={() => {
              if (confirm(`Remove budget for "${props.budget.categoryName}"?`))
                props.onDelete(props.budget.categoryId);
            }}
            className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function RulesPage() {
  const qc = useQueryClient();
  const rulesQ = useQuery({ queryKey: ['rules'], queryFn: fetchRules, staleTime: 2 * 60 * 1000 });
  const catsQ = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 10 * 60 * 1000 });
  const accountsQ = useQuery({ queryKey: ['accounts'], queryFn: () => fetchAccounts(false), staleTime: 2 * 60 * 1000 });
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
          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm sm:w-64"
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
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Match</th>
            <th className="px-3 py-2 font-medium">Pattern</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Priority</th>
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
      <td className="hidden px-3 py-2 text-zinc-600 sm:table-cell">
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
      <td className="hidden px-3 py-2 sm:table-cell">
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
  onEdit: (txn: Transaction) => void;
  isPending: boolean;
}) {
  return (
    <>
      {/* Mobile card list */}
      <div className="flex flex-col divide-y divide-zinc-100 rounded border border-zinc-200 md:hidden">
        {props.rows.map((r) => (
          <div key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.description}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {r.transactionDate}
                  {r.accountName ? ` · ${r.accountName}` : ''}
                </div>
              </div>
              <div
                className={`shrink-0 tabular-nums text-sm font-medium ${
                  Number(r.amount) < 0 ? 'text-emerald-700' : 'text-zinc-900'
                }`}
              >
                {fmtMoney(r.amount)}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select
                className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
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
              {r.autoCategorized && (
                <span className="shrink-0 text-xs text-zinc-400">auto</span>
              )}
              <button
                type="button"
                onClick={() => props.onEdit(r)}
                className="shrink-0 rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800"
              >
                Edit
              </button>
            </div>
            {r.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {r.tags.map((t) => (
                  <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded border border-zinc-200 md:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 tabular-nums text-zinc-600">{r.transactionDate}</td>
                <td className="px-3 py-2 text-zinc-600">{r.accountName ?? '—'}</td>
                <td className="px-3 py-2">
                  <div>{r.description}</div>
                  {r.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
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
                  {r.autoCategorized && (
                    <span className="ml-1 text-xs text-zinc-400">auto</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => props.onEdit(r)}
                    className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function fmtMoney(s: string): string {
  const n = Number(s);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

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
  fetchForecast,
  fetchRules,
  fetchSettings,
  fetchSummary,
  fetchTopMerchants,
  fetchTransactions,
  logout,
  patchTransactionCategory,
  submitCategorizationFeedback,
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
import { BalanceHero } from './BalanceHero';
import { CashflowForecast } from './CashflowForecast';
import { CategoryTrends } from './CategoryTrends';
import { InsightCards } from './InsightCards';
import { SpendingPie } from './SpendingPie';
import { SummaryCards } from './SummaryCards';
import { MonthlyTrend } from './MonthlyTrend';
import { TopMerchants } from './TopMerchants';
import { TxnEditModal } from './TxnEditModal';
import { CategoriesPage } from './CategoriesPage';
import { CATEGORY_PILL } from './categoryColors';

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

  useEffect(() => {
    function onExpired() {
      queryClient.setQueryData(['auth/me'], null);
    }
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [queryClient]);

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

  if (authQuery.isError || !authQuery.data) {
    return <LoginPage />;
  }

  const isAdmin = authQuery.data?.user?.role === 'admin';
  return <AppShell onLogout={handleLogout} showLogout={!!authQuery.data?.user} isAdmin={isAdmin} />;
}

const MORE_VIEWS: View[] = ['goals', 'bills', 'rules', 'categories'];

function AppShell({ onLogout, showLogout, isAdmin }: { onLogout: () => void; showLogout: boolean; isAdmin: boolean }) {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.slice(1) as View;
    const VALID: View[] = ['dashboard', 'accounts', 'budgets', 'goals', 'bills', 'rules', 'categories', 'settings'];
    const requested = VALID.includes(hash) ? hash : 'dashboard';
    return requested === 'settings' && !isAdmin ? 'dashboard' : requested;
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_VIEWS.includes(view);

  function navigate(v: View) {
    setView(v);
    window.location.hash = v;
    setMoreOpen(false);
  }

  return (
    <>
      {/* Full-width sticky top nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            <LogoMark size={28} />
            <span
              className="hidden text-base font-bold text-teal-900 sm:block"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Pennywise
            </span>
          </div>

          {/* Desktop nav pills */}
          <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
            <TabButton active={view === 'dashboard'} onClick={() => navigate('dashboard')} icon={<NavIconGrid />}>Dashboard</TabButton>
            <TabButton active={view === 'accounts'} onClick={() => navigate('accounts')} icon={<NavIconCard />}>Accounts</TabButton>
            <TabButton active={view === 'budgets'} onClick={() => navigate('budgets')} icon={<NavIconBars />}>Budgets</TabButton>
            <TabButton active={view === 'goals'} onClick={() => navigate('goals')} icon={<NavIconTarget />}>Goals</TabButton>
            <TabButton active={view === 'bills'} onClick={() => navigate('bills')} icon={<NavIconReceipt />}>Bills</TabButton>
            <TabButton active={view === 'rules'} onClick={() => navigate('rules')} icon={<NavIconFilter />}>Rules</TabButton>
            <TabButton active={view === 'categories'} onClick={() => navigate('categories')} icon={<NavIconTag />}>Categories</TabButton>
            {isAdmin && <TabButton active={view === 'settings'} onClick={() => navigate('settings')} icon={<NavIconCog />}>Settings</TabButton>}
          </nav>

          {/* Right side: sign out */}
          <div className="ml-auto hidden shrink-0 items-center gap-3 md:flex">
            {showLogout && (
              <button
                onClick={onLogout}
                className="text-sm text-zinc-400 hover:text-zinc-700"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-3 pb-24 sm:p-6 md:pb-6">
        {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {view === 'accounts' && <AccountsPage />}
        {view === 'budgets' && <BudgetsPage />}
        {view === 'goals' && <GoalsPage />}
        {view === 'bills' && <BillsPage />}
        {view === 'rules' && <RulesPage />}
        {view === 'categories' && <CategoriesPage />}
        {view === 'settings' && <SettingsPage />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white md:hidden">
        <div className="flex">
          <BottomNavButton active={view === 'dashboard'} onClick={() => navigate('dashboard')} label="Dashboard"><IconHome /></BottomNavButton>
          <BottomNavButton active={view === 'accounts'} onClick={() => navigate('accounts')} label="Accounts"><IconCard /></BottomNavButton>
          <BottomNavButton active={view === 'budgets'} onClick={() => navigate('budgets')} label="Budgets"><IconBars /></BottomNavButton>
          {isAdmin && <BottomNavButton active={view === 'settings'} onClick={() => navigate('settings')} label="Settings"><IconCog /></BottomNavButton>}
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
                    view === v ? 'bg-zinc-100 font-medium text-teal-800' : 'text-zinc-700 active:bg-zinc-50'
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

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
        props.active
          ? 'bg-teal-800 text-white'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
      }`}
    >
      {props.icon}
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
        props.active ? 'text-teal-800' : 'text-zinc-400 active:text-zinc-600'
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

/* Logo mark — 2×2 grid of rounded squares */
function LogoMark({ size = 28, variant = 'light' }: { size?: number; variant?: 'light' | 'dark' }) {
  const colors =
    variant === 'dark'
      ? { tl: '#FFFFFF', tr: 'rgba(255,255,255,0.55)', bl: 'rgba(255,255,255,0.3)', br: '#22C55E' }
      : { tl: '#0B3F3A', tr: '#94A3B8', bl: '#CBD5E1', br: '#22C55E' };
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="0"  y="0"  width="13" height="13" rx="3" fill={colors.tl} />
      <rect x="15" y="0"  width="13" height="13" rx="3" fill={colors.tr} />
      <rect x="0"  y="15" width="13" height="13" rx="3" fill={colors.bl} />
      <rect x="15" y="15" width="13" height="13" rx="3" fill={colors.br} />
    </svg>
  );
}

/* Nav icons (h-4 w-4) used only in the desktop top nav pills */
function NavIconGrid() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function NavIconCard() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.5 4A1.5 1.5 0 001 5.5V6h18v-.5A1.5 1.5 0 0017.5 4h-15zM19 8.5H1v6A1.5 1.5 0 002.5 16h15a1.5 1.5 0 001.5-1.5v-6zM3 13.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm5.25-.75a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" /></svg>;
}
function NavIconBars() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M12 3a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1V4a1 1 0 00-1-1h-2zM6.5 8a1 1 0 00-1 1v7a1 1 0 001 1h2a1 1 0 001-1V9a1 1 0 00-1-1h-2zM2 13a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3z" /></svg>;
}
function NavIconTarget() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm0-2a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>;
}
function NavIconReceipt() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;
}
function NavIconFilter() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>;
}
function NavIconTag() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
}
function NavIconCog() {
  return <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>;
}

function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [month, setMonth] = useState<string>(
    () => localStorage.getItem('dashboard:month') ?? new Date().toISOString().slice(0, 7)
  );
  const [accountId, setAccountId] = useState<string>(
    () => localStorage.getItem('dashboard:accountId') ?? ''
  );
  const qc = useQueryClient();

  useEffect(() => { localStorage.setItem('dashboard:month', month); }, [month]);
  useEffect(() => { localStorage.setItem('dashboard:accountId', accountId); }, [accountId]);

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

  const hasAppliedDefault = useRef(false);
  useEffect(() => {
    if (hasAppliedDefault.current) return;
    if (!settingsQ.data || !availableMonthsQ.data) return;
    // If the user has a saved preference, honour it and don't override
    if (localStorage.getItem('dashboard:month')) {
      hasAppliedDefault.current = true;
      return;
    }
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

  const prevMonth = clientAddMonths(month, -1);
  const prevSummaryQ = useQuery({
    queryKey: ['summary', prevMonth, accountId],
    queryFn: () => fetchSummary(prevMonth, accountId || undefined),
    staleTime: 5 * 60 * 1000,
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

  const forecastQ = useQuery({
    queryKey: ['forecast', month, accountId],
    queryFn: () => fetchForecast(month, accountId || undefined),
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-zinc-600">
          <span className="shrink-0">Month</span>
          <div className="relative">
            <select
              className="appearance-none rounded-xl border border-zinc-300 bg-white py-1.5 pl-3 pr-8 text-sm text-zinc-700 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600">
          <span className="shrink-0">Account</span>
          <div className="relative">
            <select
              className="appearance-none rounded-xl border border-zinc-300 bg-white py-1.5 pl-3 pr-8 text-sm text-zinc-700 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">All</option>
              {(accountsQ.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
              <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </label>
        <div className="ml-auto">
          <a href="/api/exports/backup.json" className="rounded-xl border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
            Backup
          </a>
        </div>
      </div>

      <BalanceHero
        accounts={accountsQ.data ?? []}
        onImport={() => document.getElementById('upload-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        onAddAccount={() => onNavigate('accounts')}
      />

      <div id="upload-form">
        <UploadForm accounts={accountsQ.data ?? []} />
      </div>

      <SummaryCards
        summary={summaryQ.data}
        prevSummary={prevSummaryQ.data}
        isLoading={summaryQ.isLoading}
      />

      <InsightCards
        data={insightsQ.data}
        isLoading={insightsQ.isLoading}
        onNavigate={(v) => onNavigate(v as View)}
      />

      <CashflowForecast data={forecastQ.data} isLoading={forecastQ.isLoading} />

      {budgetStatusQ.data && budgetStatusQ.data.length > 0 && (
        <BudgetStatusPanel data={budgetStatusQ.data} />
      )}

      {goalsQ.data && goalsQ.data.length > 0 && (
        <GoalsPanel goals={goalsQ.data} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {byCat.data && cats.data && <SpendingPie totals={byCat.data} categories={cats.data} />}
        {byMonthQ.data && <MonthlyTrend data={byMonthQ.data} months={chartMonths} />}
      </div>

      {topMerchantsQ.data && <TopMerchants data={topMerchantsQ.data} />}

      {categoryTrendsQ.data && <CategoryTrends data={categoryTrendsQ.data} months={chartMonths} />}

      {/* Two-column: Recent Activity (left) + My Accounts (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent Activity card */}
        <RecentActivityCard
          month={month}
          accountId={accountId}
          accounts={accountsQ.data ?? []}
        />

        {/* My Accounts mini panel */}
        <DashboardAccountsMini
          accounts={accountsQ.data ?? []}
          onSeeAll={() => onNavigate('accounts')}
        />
      </div>

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
      className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        upload.mutate();
      }}
    >
      <span className="shrink-0 text-sm text-zinc-600">Import CSV / OFX / QFX to:</span>
      <div className="relative">
        <select
          required
          className="appearance-none rounded-xl border border-zinc-300 bg-white py-1.5 pl-3 pr-8 text-sm text-zinc-700 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
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
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg className="h-4 w-4 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
        <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
        </svg>
        <span className="max-w-[160px] truncate">{file ? file.name : 'Choose file'}</span>
        <input
          type="file"
          accept=".csv,.ofx,.qfx,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>
      <button
        type="submit"
        disabled={!accountId || !file || upload.isPending}
        className="rounded-xl bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
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
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
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
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Type">
        <select
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
      </Field>
      <Field label="Last 4">
        <input
          pattern="\d{4}"
          maxLength={4}
          className="w-20 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={lastFour}
          onChange={(e) => setLastFour(e.target.value)}
        />
      </Field>
      <Field label="Opening balance">
        <input
          inputMode="decimal"
          placeholder="0.00"
          className="w-28 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={props.isPending}
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
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
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
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
          className="w-full rounded-xl border border-zinc-300 px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={archived}
        />
      </td>
      <td className="px-3 py-2">
        <select
          className="rounded-xl border border-zinc-300 px-2 py-1"
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
            className="rounded bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
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
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={handleSubmit}
    >
      <Field label="Category">
        <select
          required
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
          className="w-32 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={props.isPending || !categoryId || !amount}
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
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
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
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
          className="w-32 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
            className="rounded bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
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
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
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
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
          className="w-full rounded-xl border border-zinc-300 px-2 py-1 text-sm sm:w-64"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        />
      </Field>
      <Field label="Category">
        <select
          required
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
          className="w-20 rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
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
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <Field label="Apply scope">
        <select
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
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
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
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
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
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
          className="rounded-xl border border-zinc-300 px-2 py-1"
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
          className="w-16 rounded-xl border border-zinc-300 px-2 py-1"
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


function AiStatusBadge(props: {
  txn: Transaction;
  onFeedback: (id: string, correct: boolean) => void;
  onEdit: (t: Transaction) => void;
}) {
  const { txn } = props;
  if (!txn.autoCategorized) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
        Manual
      </span>
    );
  }
  if (txn.categorizationFeedback === 'correct') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        Auto{' '}
        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (txn.categorizationFeedback === 'incorrect') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        Wrong{' '}
        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
        Auto?
      </span>
      <button
        type="button"
        title="Correct categorization"
        onClick={() => props.onFeedback(txn.id, true)}
        className="rounded p-1 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
      >
        <IconThumbUp />
      </button>
      <button
        type="button"
        title="Wrong — fix it"
        onClick={() => { props.onFeedback(txn.id, false); props.onEdit(txn); }}
        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
      >
        <IconThumbDown />
      </button>
    </div>
  );
}

function RecentActivityCard(props: {
  month: string;
  accountId: string;
  accounts: Account[];
}) {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tag, setTag] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [feedbackOverrides, setFeedbackOverrides] = useState<Map<string, 'correct' | 'incorrect'>>(new Map());

  const txnsQ = useInfiniteQuery({
    queryKey: ['transactions', props.month, props.accountId, search, tag, categoryFilter],
    queryFn: ({ pageParam }) =>
      fetchTransactions(props.month, props.accountId || undefined, search || undefined, pageParam, tag || undefined, categoryFilter || undefined),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined,
    staleTime: 30 * 1000,
  });

  const allTxns = useMemo(
    () =>
      (txnsQ.data?.pages.flatMap((p) => p.rows) ?? []).map((t) => ({
        ...t,
        categorizationFeedback: feedbackOverrides.get(t.id) ?? t.categorizationFeedback,
      })),
    [txnsQ.data, feedbackOverrides],
  );
  const txnTotal = txnsQ.data?.pages[0]?.total ?? 0;
  const hasMore = txnsQ.data?.pages.at(-1)?.hasMore ?? false;

  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  const tagsQ = useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 2 * 60 * 1000,
  });

  const categoryOptions = useMemo(() => buildCategoryOptions(catsQ.data ?? []), [catsQ.data]);

  const feedbackMut = useMutation({
    mutationFn: ({ id, correct }: { id: string; correct: boolean }) =>
      submitCategorizationFeedback(id, correct),
  });

  function handleFeedback(id: string, correct: boolean) {
    setFeedbackOverrides((prev) => new Map(prev).set(id, correct ? 'correct' : 'incorrect'));
    feedbackMut.mutate({ id, correct });
  }

  const csvHref = useMemo(() => {
    const p = new URLSearchParams({ month: props.month });
    if (props.accountId) p.set('accountId', props.accountId);
    if (search) p.set('q', search);
    if (tag) p.set('tag', tag);
    if (categoryFilter) p.set('categoryId', categoryFilter);
    return `/api/exports/transactions.csv?${p.toString()}`;
  }, [props.month, props.accountId, search, tag, categoryFilter]);

  const activeFilterCount = (search ? 1 : 0) + (tag ? 1 : 0) + (categoryFilter ? 1 : 0);

  const accountMap = useMemo(
    () => new Map(props.accounts.map((a) => [a.id, a])),
    [props.accounts],
  );

  const needsReviewCount = allTxns.filter(
    (t) => t.autoCategorized && t.categorizationFeedback === null,
  ).length;

  const sortedRows = useMemo(() => {
    const copy = [...allTxns];
    copy.sort((a, b) => {
      const cmp = a.transactionDate.localeCompare(b.transactionDate);
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [allTxns, sortAsc]);

  const colTemplate = '1fr 5.5rem 7rem 8rem 8rem';

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <svg
            width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
            className="shrink-0 text-zinc-400"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-800 tracking-tight">Recent Activity</h2>
        </div>
        <div className="flex items-center gap-2">
          {needsReviewCount > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
              {needsReviewCount} need review
            </span>
          )}
          {!txnsQ.isLoading && (
            <span className="text-xs text-zinc-400">
              {allTxns.length} of {txnTotal}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilterCount > 0
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            title={sortAsc ? 'Oldest first — click for newest first' : 'Newest first — click for oldest first'}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 6h18M6 12h12M9 18h6" />
            </svg>
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </div>

      {/* Inline filter panel */}
      {filtersOpen && (
        <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search description / merchant…"
              className="w-52 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select
              className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              <option value="none">Uncategorized</option>
              {(catsQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `  ${c.name}` : c.name}
                </option>
              ))}
            </select>
            {(tagsQ.data ?? []).length > 0 && (
              <select
                className="rounded-xl border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              >
                <option value="">All tags</option>
                {(tagsQ.data ?? []).map((tg) => (
                  <option key={tg} value={tg}>{tg}</option>
                ))}
              </select>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setCategoryFilter(''); setTag(''); }}
                className="text-xs text-zinc-400 hover:text-zinc-700"
              >
                Clear
              </button>
            )}
            <a
              href={csvHref}
              className="ml-auto rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Export CSV
            </a>
          </div>
        </div>
      )}

      {/* States */}
      {txnsQ.isLoading && <p className="px-5 py-3 text-sm text-zinc-500">Loading…</p>}
      {txnsQ.error && <p className="px-5 py-3 text-sm text-red-600">{(txnsQ.error as Error).message}</p>}
      {!txnsQ.isLoading && allTxns.length === 0 && (
        <p className="px-5 py-6 text-center text-sm text-zinc-400">No transactions match.</p>
      )}

      {allTxns.length > 0 && (
        <>
          {/* Mobile card list */}
          <div className="flex flex-col divide-y divide-zinc-100 md:hidden">
            {sortedRows.map((t) => {
              const pill = CATEGORY_PILL[(t.categorySlug ?? '').split('.')[0] ?? ''] ?? { bg: 'bg-zinc-100', text: 'text-zinc-500' };
              const needsReview = t.autoCategorized && t.categorizationFeedback === null;
              return (
                <div
                  key={t.id}
                  className="p-3"
                  style={needsReview ? { boxShadow: 'inset 3px 0 0 #fbbf24' } : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-zinc-900">{t.description}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {fmtDate(t.transactionDate)}
                        {t.accountName ? ` · ${t.accountName}` : ''}
                      </div>
                    </div>
                    <div className={`shrink-0 tabular-nums text-[13px] font-semibold ${Number(t.amount) < 0 ? 'text-emerald-600' : 'text-zinc-800'}`}>
                      {fmtActivityAmount(t.amount)}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {t.hasSplits ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        Split
                      </span>
                    ) : t.categoryName ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.bg} ${pill.text}`}>
                        {t.categoryName}
                      </span>
                    ) : null}
                    <AiStatusBadge txn={t} onFeedback={handleFeedback} onEdit={setEditingTxn} />
                    <button
                      type="button"
                      onClick={() => setEditingTxn(t)}
                      className="ml-auto rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            {/* Column headers */}
            <div
              className="grid gap-3 border-b border-zinc-100 px-5 py-2 text-[10px] font-bold tracking-[0.1em] uppercase text-zinc-400"
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div>Type</div>
              <div className="text-right">Amount</div>
              <div className="text-center">Category</div>
              <div className="text-center">AI Status</div>
              <div>Account</div>
            </div>
            {/* Rows */}
            {sortedRows.map((t) => {
              const pill = CATEGORY_PILL[(t.categorySlug ?? '').split('.')[0] ?? ''] ?? { bg: 'bg-zinc-100', text: 'text-zinc-500' };
              const acct = accountMap.get(t.accountId);
              const needsReview = t.autoCategorized && t.categorizationFeedback === null;
              return (
                <div
                  key={t.id}
                  className="group grid gap-3 border-b border-zinc-100 px-5 py-2.5 last:border-0 transition-colors hover:bg-zinc-50"
                  style={{
                    gridTemplateColumns: colTemplate,
                    boxShadow: needsReview ? 'inset 3px 0 0 #fbbf24' : 'none',
                  }}
                >
                  {/* Description + date */}
                  <div className="min-w-0 self-center">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{t.description}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span>{fmtDate(t.transactionDate)}</span>
                      {t.tags.length > 0 && (
                        <>
                          <span className="text-zinc-200">·</span>
                          {t.tags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Amount */}
                  <div className="self-center text-right">
                    <span className={`tabular-nums text-[13px] font-semibold ${Number(t.amount) < 0 ? 'text-emerald-600' : 'text-zinc-800'}`}>
                      {fmtActivityAmount(t.amount)}
                    </span>
                  </div>
                  {/* Category pill */}
                  <div className="flex items-center justify-center self-center">
                    {t.hasSplits ? (
                      <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                        Split
                      </span>
                    ) : t.categoryName ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pill.bg} ${pill.text}`}>
                        {t.categoryName}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">—</span>
                    )}
                  </div>
                  {/* AI Status */}
                  <div className="flex items-center justify-center self-center">
                    <AiStatusBadge txn={t} onFeedback={handleFeedback} onEdit={setEditingTxn} />
                  </div>
                  {/* Account + hover Edit */}
                  <div className="flex items-center justify-between self-center">
                    <div>
                      <div className="text-xs font-medium text-zinc-700">{t.accountName ?? '—'}</div>
                      {acct?.lastFour && (
                        <div className="mt-0.5 tabular-nums text-xs text-zinc-400">**** {acct.lastFour}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingTxn(t)}
                      className="ml-2 shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-400 opacity-0 transition-all hover:bg-zinc-50 hover:text-zinc-700 group-hover:opacity-100"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="border-t border-zinc-100 px-5 py-2">
              <button
                type="button"
                onClick={() => txnsQ.fetchNextPage()}
                disabled={txnsQ.isFetchingNextPage}
                className="w-full rounded-xl py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
              >
                {txnsQ.isFetchingNextPage ? 'Loading…' : `Load ${txnTotal - allTxns.length} more`}
              </button>
            </div>
          )}
        </>
      )}

      {editingTxn && (
        <TxnEditModal
          txn={editingTxn}
          categories={categoryOptions}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </div>
  );
}

function TransactionTable(props: {
  rows: Transaction[];
  categories: CategoryOption[];
  onChange: (id: string, categoryId: string | null) => void;
  onEdit: (txn: Transaction) => void;
  onFeedback: (id: string, correct: boolean) => void;
  isPending: boolean;
  bare?: boolean;
}) {
  const outerCls = props.bare ? '' : 'rounded-xl border border-zinc-200';
  return (
    <>
      {/* Mobile card list */}
      <div className={`flex flex-col divide-y divide-zinc-100 md:hidden ${outerCls}`}>
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
                className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-2 py-1 text-xs"
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
              {r.autoCategorized && r.categorizationFeedback === null && (
                <>
                  <button
                    type="button"
                    title="Correct categorization"
                    onClick={() => props.onFeedback(r.id, true)}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                  >
                    <IconThumbUp />
                  </button>
                  <button
                    type="button"
                    title="Wrong categorization"
                    onClick={() => props.onFeedback(r.id, false)}
                    className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <IconThumbDown />
                  </button>
                </>
              )}
              {r.autoCategorized && r.categorizationFeedback === 'correct' && (
                <span className="shrink-0 text-xs text-emerald-600">✓ auto</span>
              )}
              {r.autoCategorized && r.categorizationFeedback === null && (
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
      <div className={`hidden overflow-x-auto md:block ${outerCls}`}>
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
                  <div className="flex items-center gap-1">
                    <select
                      className="flex-1 rounded-xl border border-zinc-300 bg-white px-2 py-1"
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
                    {r.autoCategorized && r.categorizationFeedback === null && (
                      <>
                        <span className="text-xs text-zinc-400">auto</span>
                        <button
                          type="button"
                          title="Correct categorization"
                          onClick={() => props.onFeedback(r.id, true)}
                          className="rounded p-1 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <IconThumbUp />
                        </button>
                        <button
                          type="button"
                          title="Wrong categorization"
                          onClick={() => props.onFeedback(r.id, false)}
                          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <IconThumbDown />
                        </button>
                      </>
                    )}
                    {r.autoCategorized && r.categorizationFeedback === 'correct' && (
                      <span className="text-xs text-emerald-600">✓ auto</span>
                    )}
                  </div>
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

function IconThumbUp() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 01-1.341-.317l-1.734-.868A4.5 4.5 0 006.5 15.5v-8.67a3 3 0 011.5-2.598l1-.577A2 2 0 0111 3z" />
    </svg>
  );
}

function IconThumbDown() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M18.905 12.75a1.25 1.25 0 11-2.5 0v-7.5a1.25 1.25 0 012.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 015.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247.193-2.08.652-4.082 1.341-5.974C2.752 3.678 3.833 3 5.005 3h3.192a3 3 0 011.342.317l1.733.868A4.501 4.501 0 0013.405 4.5v8.67a3 3 0 01-1.5 2.598l-1 .577a2 2 0 01-2 0z" />
    </svg>
  );
}

function fmtMoney(s: string): string {
  const n = Number(s);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Activity card: flip sign so expenses show as -$X and income as +$X
function fmtActivityAmount(s: string): string {
  const n = Number(s);
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  if (n > 0) return `-${abs}`;
  if (n < 0) return `+${abs}`;
  return abs;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

}

const ACCOUNT_CARD_COLORS = [
  'bg-teal-800',
  'bg-emerald-500',
  'bg-teal-700',
  'bg-emerald-600',
] as const;

function DashboardAccountsMini({
  accounts,
  onSeeAll,
}: {
  accounts: Account[];
  onSeeAll: () => void;
}) {
  const active = accounts.filter((a) => a.archivedAt === null);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="shrink-0 text-zinc-400">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <h2 className="text-sm font-semibold text-zinc-800">My Accounts</h2>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs text-teal-700 hover:text-teal-900"
        >
          See All →
        </button>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {active.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-400">
            No accounts yet.{' '}
            <button type="button" onClick={onSeeAll} className="text-teal-700 hover:underline">
              Add one →
            </button>
          </p>
        )}
        {active.slice(0, 4).map((account, i) => (
          <AccountMiniCard
            key={account.id}
            account={account}
            colorClass={ACCOUNT_CARD_COLORS[i % ACCOUNT_CARD_COLORS.length]!}
          />
        ))}
      </div>
    </div>
  );
}

function AccountMiniCard({
  account,
  colorClass,
}: {
  account: Account;
  colorClass: string;
}) {
  const bal = Number(account.currentBalance);
  const fmtBal = bal.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  const typeLabel = account.type.replace('_', ' ').toUpperCase();

  return (
    <div className={`rounded-xl p-4 text-white ${colorClass}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest opacity-75">
          {typeLabel}
        </span>
        {account.institution && account.lastFour && (
          <span className="text-[10px] opacity-60">
            {account.institution} • ****{account.lastFour}
          </span>
        )}
      </div>
      <p className="mb-1 truncate text-sm font-medium opacity-90">{account.name}</p>
      <p
        className="font-display text-2xl font-bold tabular-nums tracking-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {fmtBal}
      </p>
    </div>
  );
}

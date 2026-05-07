export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment';

export interface Account {
  id: string;
  householdId: string;
  name: string;
  type: AccountType;
  institution: string | null;
  lastFour: string | null;
  openingBalance: string;
  currencyCode: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentBalance: string;
}

export interface AccountCreateBody {
  name: string;
  type: AccountType;
  institution?: string | null;
  lastFour?: string | null;
  openingBalance?: string;
  currencyCode?: string;
}

export type AccountUpdateBody = Partial<AccountCreateBody>;

export interface Transaction {
  id: string;
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  merchant: string | null;
  notes: string | null;
  tags: string[];
  accountId: string;
  accountName: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  autoCategorized: boolean;
}

export interface TransactionUpdateBody {
  description?: string;
  merchant?: string | null;
  notes?: string | null;
  tags?: string[];
  categoryId?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
}

export interface Summary {
  month: string | null;
  accountId: string | null;
  income: string;
  expenses: string;
  net: string;
  txnCount: number;
  uncategorizedCount: number;
  largestCategory: {
    categoryId: string | null;
    slug: string | null;
    name: string | null;
    total: string;
  } | null;
}

export interface MonthlyPoint {
  month: string;
  income: string;
  expenses: string;
}

export interface MerchantTotal {
  key: string;
  total: string;
  count: number;
}

export interface CategoryTotal {
  categoryId: string | null;
  slug: string | null;
  name: string | null;
  total: string;
  count: number;
}

export interface TransactionEdit {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  editedAt: string;
}

export interface InsightsData {
  uncategorizedCount: number;
  topCategory: {
    name: string;
    slug: string;
    currentTotal: string;
    priorTotal: string;
    changePct: number | null;
  } | null;
  largestRecurring: {
    merchant: string;
    avgMonthlyTotal: string;
    monthCount: number;
  } | null;
}

export interface CategoryTrendPoint {
  month: string;
  slug: string;
  name: string;
  total: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  // computed by server
  pct: number;
  remaining: string;
  daysRemaining: number | null;
  onTrack: boolean | null;
}

export interface GoalCreateBody {
  name: string;
  targetAmount: string;
  targetDate?: string | null;
  notes?: string | null;
}

export function fetchGoals(): Promise<SavingsGoal[]> {
  return jget<SavingsGoal[]>('/api/goals');
}

export function createGoal(body: GoalCreateBody): Promise<SavingsGoal> {
  return jsend<SavingsGoal>('/api/goals', 'POST', body);
}

export function updateGoal(id: string, body: Partial<GoalCreateBody>): Promise<SavingsGoal> {
  return jsend<SavingsGoal>(`/api/goals/${id}`, 'PATCH', body);
}

export function contributeToGoal(id: string, amount: string): Promise<SavingsGoal> {
  return jsend<SavingsGoal>(`/api/goals/${id}/contribute`, 'POST', { amount });
}

export async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export interface RecurringBill {
  id: string;
  name: string;
  matchPattern: string;
  expectedAmount: string | null;
  categoryId: string | null;
  categoryName: string | null;
  dueDay: number | null;
  isActive: boolean;
}

export interface BillStatus extends RecurringBill {
  paid: boolean;
  paidAmount: string | null;
  paidDate: string | null;
  transactionId: string | null;
}

export interface BillSuggestion {
  pattern: string;
  monthCount: number;
  avgAmount: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  amount: string;
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  budget: string;
  actual: string;
  remaining: string;
  pct: number;
  isOver: boolean;
}

export interface ImportResult {
  parsed: number;
  inserted: number;
  skipped: number;
  autoCategorized: number;
  errors: { rowIndex: number; message: string }[];
}

export type RuleMatchType =
  | 'merchant_contains'
  | 'merchant_equals'
  | 'description_contains'
  | 'description_regex';

export interface Rule {
  id: string;
  householdId: string;
  matchType: RuleMatchType;
  pattern: string;
  caseInsensitive: boolean;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCreateBody {
  matchType: RuleMatchType;
  pattern: string;
  caseInsensitive?: boolean;
  categoryId: string;
  priority?: number;
  enabled?: boolean;
}

export type RuleUpdateBody = Partial<RuleCreateBody>;

export type RuleApplyScope = 'uncategorized' | 'auto_categorized' | 'all_unedited';

export interface RuleApplyResult {
  scanned: number;
  matched: number;
  updated: number;
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

async function jsend<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${res.status} ${url}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.set(k, v as string);
  return `?${usp.toString()}`;
}

export interface TransactionPage {
  rows: Transaction[];
  total: number;
  hasMore: boolean;
}

export function fetchTransactions(
  month?: string,
  accountId?: string,
  q?: string,
  offset?: number,
  tag?: string,
  categoryId?: string,
): Promise<TransactionPage> {
  return jget<TransactionPage>(
    `/api/transactions${buildQuery({
      month,
      accountId,
      q,
      tag,
      categoryId,
      offset: offset ? String(offset) : undefined,
    })}`,
  );
}

export function fetchTags(): Promise<string[]> {
  return jget<string[]>('/api/transactions/tags');
}

export function fetchCategories(): Promise<Category[]> {
  return jget<Category[]>('/api/categories');
}

export function createCategory(body: { name: string; parentId: string }): Promise<Category> {
  return jsend<Category>('/api/categories', 'POST', body);
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete category ${res.status}`);
}

export function fetchByCategory(month?: string, accountId?: string): Promise<CategoryTotal[]> {
  return jget<CategoryTotal[]>(
    `/api/transactions/by-category${buildQuery({ month, accountId })}`,
  );
}

export function fetchSummary(month?: string, accountId?: string): Promise<Summary> {
  return jget<Summary>(`/api/transactions/summary${buildQuery({ month, accountId })}`);
}

export function fetchByMonth(
  from?: string,
  to?: string,
  accountId?: string,
): Promise<MonthlyPoint[]> {
  return jget<MonthlyPoint[]>(`/api/transactions/by-month${buildQuery({ from, to, accountId })}`);
}

export function fetchTransactionHistory(id: string): Promise<TransactionEdit[]> {
  return jget<TransactionEdit[]>(`/api/transactions/${id}/history`);
}

export function fetchInsights(month?: string, accountId?: string): Promise<InsightsData> {
  return jget<InsightsData>(`/api/transactions/insights${buildQuery({ month, accountId })}`);
}

export function fetchCategoryTrends(
  from?: string,
  to?: string,
  accountId?: string,
): Promise<CategoryTrendPoint[]> {
  return jget<CategoryTrendPoint[]>(
    `/api/transactions/category-trends${buildQuery({ from, to, accountId })}`,
  );
}

export function fetchTopMerchants(
  month?: string,
  accountId?: string,
  limit?: number,
): Promise<MerchantTotal[]> {
  return jget<MerchantTotal[]>(
    `/api/transactions/top-merchants${buildQuery({
      month,
      accountId,
      limit: limit ? String(limit) : undefined,
    })}`,
  );
}

export async function patchTransactionCategory(
  id: string,
  categoryId: string | null,
): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ categoryId }),
  });
  if (!res.ok) throw new Error(`patch ${res.status}`);
}

export function patchTransaction(id: string, body: TransactionUpdateBody): Promise<Transaction> {
  return jsend<Transaction>(`/api/transactions/${id}`, 'PATCH', body);
}

export function fetchAccounts(includeArchived = false): Promise<Account[]> {
  const q = includeArchived ? '?includeArchived=true' : '';
  return jget<Account[]>(`/api/accounts${q}`);
}

export function createAccount(body: AccountCreateBody): Promise<Account> {
  return jsend<Account>('/api/accounts', 'POST', body);
}

export function updateAccount(id: string, body: AccountUpdateBody): Promise<Account> {
  return jsend<Account>(`/api/accounts/${id}`, 'PATCH', body);
}

export async function archiveAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export function fetchRules(): Promise<Rule[]> {
  return jget<Rule[]>('/api/rules');
}

export function createRule(body: RuleCreateBody): Promise<Rule> {
  return jsend<Rule>('/api/rules', 'POST', body);
}

export function updateRule(id: string, body: RuleUpdateBody): Promise<Rule> {
  return jsend<Rule>(`/api/rules/${id}`, 'PATCH', body);
}

export async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export function applyRulesNow(
  scope: RuleApplyScope,
  accountId?: string,
): Promise<RuleApplyResult> {
  const body: { scope: RuleApplyScope; accountId?: string } = { scope };
  if (accountId) body.accountId = accountId;
  return jsend<RuleApplyResult>('/api/rules/apply', 'POST', body);
}

export function fetchBills(): Promise<RecurringBill[]> {
  return jget<RecurringBill[]>('/api/bills');
}

export function fetchBillsStatus(month?: string): Promise<BillStatus[]> {
  return jget<BillStatus[]>(`/api/bills/status${buildQuery({ month })}`);
}

export function fetchBillSuggestions(month?: string): Promise<BillSuggestion[]> {
  return jget<BillSuggestion[]>(`/api/bills/suggestions${buildQuery({ month })}`);
}

export interface BillCreateBody {
  name: string;
  matchPattern: string;
  expectedAmount?: string | null;
  categoryId?: string | null;
  dueDay?: number | null;
}

export function createBill(body: BillCreateBody): Promise<RecurringBill> {
  return jsend<RecurringBill>('/api/bills', 'POST', body);
}

export function updateBill(id: string, body: Partial<BillCreateBody>): Promise<RecurringBill> {
  return jsend<RecurringBill>(`/api/bills/${id}`, 'PATCH', body);
}

export async function deleteBill(id: string): Promise<void> {
  const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export function fetchBudgets(): Promise<Budget[]> {
  return jget<Budget[]>('/api/budgets');
}

export interface BudgetHistoryMonth {
  month: string;
  actual: string;
  pct: number;
  isOver: boolean;
}

export interface BudgetHistoryRow {
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  budget: string;
  months: BudgetHistoryMonth[];
}

export function fetchBudgetHistory(
  endMonth?: string,
  months?: number,
  accountId?: string,
): Promise<BudgetHistoryRow[]> {
  return jget<BudgetHistoryRow[]>(
    `/api/budgets/history${buildQuery({
      endMonth,
      months: months ? String(months) : undefined,
      accountId,
    })}`,
  );
}

export function fetchBudgetStatus(month?: string, accountId?: string): Promise<BudgetStatus[]> {
  return jget<BudgetStatus[]>(`/api/budgets/status${buildQuery({ month, accountId })}`);
}

export async function upsertBudget(categoryId: string, amount: string): Promise<Budget> {
  return jsend<Budget>(`/api/budgets/${categoryId}`, 'PUT', { amount });
}

export async function deleteBudget(categoryId: string): Promise<void> {
  const res = await fetch(`/api/budgets/${categoryId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export async function uploadCsv(accountId: string, file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('accountId', accountId);
  fd.append('file', file);
  const res = await fetch('/api/imports', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return res.json() as Promise<ImportResult>;
}

export interface HouseholdSettings {
  defaultPeriod: 'current' | 'previous' | 'latest_data';
  chartMonths: 3 | 6 | 12;
}

export function fetchSettings(): Promise<HouseholdSettings> {
  return jget<HouseholdSettings>('/api/settings');
}

export function updateSettings(patch: Partial<HouseholdSettings>): Promise<HouseholdSettings> {
  return jsend<HouseholdSettings>('/api/settings', 'PATCH', patch);
}

export function fetchAvailableMonths(): Promise<string[]> {
  return jget<string[]>('/api/transactions/months');
}

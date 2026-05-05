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
  accountId: string;
  accountName: string | null;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
}

export interface CategoryTotal {
  categoryId: string | null;
  slug: string | null;
  name: string | null;
  total: string;
  count: number;
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

export function fetchTransactions(month?: string, accountId?: string): Promise<Transaction[]> {
  return jget<Transaction[]>(`/api/transactions${buildQuery({ month, accountId })}`);
}

export function fetchCategories(): Promise<Category[]> {
  return jget<Category[]>('/api/categories');
}

export function fetchByCategory(month?: string, accountId?: string): Promise<CategoryTotal[]> {
  return jget<CategoryTotal[]>(
    `/api/transactions/by-category${buildQuery({ month, accountId })}`,
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

export async function uploadCsv(accountId: string, file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('accountId', accountId);
  fd.append('file', file);
  const res = await fetch('/api/imports', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return res.json() as Promise<ImportResult>;
}

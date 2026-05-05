export interface Transaction {
  id: string;
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  accountId: string;
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

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

export function fetchTransactions(month?: string): Promise<Transaction[]> {
  const q = month ? `?month=${encodeURIComponent(month)}` : '';
  return jget<Transaction[]>(`/api/transactions${q}`);
}

export function fetchCategories(): Promise<Category[]> {
  return jget<Category[]>('/api/categories');
}

export interface CategoryTotal {
  categoryId: string | null;
  slug: string | null;
  name: string | null;
  total: string;
  count: number;
}

export function fetchByCategory(month?: string): Promise<CategoryTotal[]> {
  const q = month ? `?month=${encodeURIComponent(month)}` : '';
  return jget<CategoryTotal[]>(`/api/transactions/by-category${q}`);
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

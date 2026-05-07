import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, gte, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { accounts, categories, categorizationRules, transactions } from '../db/schema.js';

const listQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  accountId: z.string().uuid().optional(),
  q: z.string().min(1).max(200).optional(),
  tag: z.string().min(1).max(100).optional(),
  categoryId: z.string().min(1).max(50).optional(),
});

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? 1 : m! + 1;
  const nextYear = m === 12 ? y! + 1 : y;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

function csvField(val: string | null | undefined): string {
  const s = val ?? '';
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const exportRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/exports/transactions.csv', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    const { month, accountId, q, tag, categoryId } = parsed.data;

    const conditions = [eq(transactions.householdId, household.id)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }
    if (q) {
      const pat = `%${q}%`;
      const orExpr = or(
        ilike(transactions.description, pat),
        ilike(transactions.originalDescription, pat),
        ilike(transactions.merchant, pat),
      );
      if (orExpr) conditions.push(orExpr);
    }
    if (tag) {
      conditions.push(sql`${tag} = ANY(${transactions.tags})`);
    }
    if (categoryId === 'none') {
      conditions.push(isNull(transactions.categoryId));
    } else if (categoryId) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }

    const rows = await db
      .select({
        transactionDate: transactions.transactionDate,
        description: transactions.description,
        originalDescription: transactions.originalDescription,
        merchant: transactions.merchant,
        amount: transactions.amount,
        categoryName: categories.name,
        accountName: accounts.name,
        notes: transactions.notes,
        autoCategorized: transactions.autoCategorized,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt));

    const header = [
      'Date',
      'Description',
      'Original Description',
      'Merchant',
      'Amount',
      'Category',
      'Account',
      'Notes',
      'Auto Categorized',
    ].join(',');

    const lines = rows.map((r) =>
      [
        csvField(r.transactionDate),
        csvField(r.description),
        csvField(r.originalDescription),
        csvField(r.merchant),
        csvField(r.amount),
        csvField(r.categoryName),
        csvField(r.accountName),
        csvField(r.notes),
        csvField(r.autoCategorized ? 'yes' : 'no'),
      ].join(','),
    );

    const suffix = [month, tag].filter(Boolean).join('-');
    const filename = suffix ? `transactions-${suffix}.csv` : 'transactions.csv';

    void reply.header('Content-Type', 'text/csv; charset=utf-8');
    void reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send([header, ...lines].join('\r\n'));
  });

  app.get('/exports/backup.json', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const [accountRows, categoryRows, transactionRows, ruleRows] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(eq(accounts.householdId, household.id))
        .orderBy(asc(accounts.createdAt)),
      db
        .select()
        .from(categories)
        .where(eq(categories.householdId, household.id))
        .orderBy(asc(categories.slug)),
      db
        .select()
        .from(transactions)
        .where(eq(transactions.householdId, household.id))
        .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt)),
      db
        .select()
        .from(categorizationRules)
        .where(eq(categorizationRules.householdId, household.id))
        .orderBy(asc(categorizationRules.priority), asc(categorizationRules.createdAt)),
    ]);

    const exportedAt = new Date().toISOString();
    const filename = `pennywise-backup-${exportedAt.slice(0, 10)}.json`;

    void reply.header('Content-Type', 'application/json; charset=utf-8');
    void reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(
      JSON.stringify(
        {
          exportedAt,
          version: '1',
          accounts: accountRows,
          categories: categoryRows,
          transactions: transactionRows,
          rules: ruleRows,
        },
        null,
        2,
      ),
    );
  });
};

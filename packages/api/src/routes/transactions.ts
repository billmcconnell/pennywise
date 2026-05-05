import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, gte, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { transactionUpdateSchema } from '@pennywise/shared';
import type { Db } from '../db/client.js';
import { accounts, categories, transactions } from '../db/schema.js';

const listQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  accountId: z.string().uuid().optional(),
  q: z.string().min(1).max(200).optional(),
});

const monthRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  accountId: z.string().uuid().optional(),
});

const topMerchantsQuerySchema = listQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});


function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? 1 : m! + 1;
  const nextYear = m === 12 ? y! + 1 : y;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export const transactionRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/transactions', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    const { month, accountId, q } = parsed.data;

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

    const rows = await db
      .select({
        id: transactions.id,
        transactionDate: transactions.transactionDate,
        amount: transactions.amount,
        description: transactions.description,
        originalDescription: transactions.originalDescription,
        merchant: transactions.merchant,
        notes: transactions.notes,
        tags: transactions.tags,
        accountId: transactions.accountId,
        accountName: accounts.name,
        categoryId: transactions.categoryId,
        categorySlug: categories.slug,
        categoryName: categories.name,
        autoCategorized: transactions.autoCategorized,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

    return rows;
  });

  app.patch<{ Params: { id: string } }>('/transactions/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const body = transactionUpdateSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });
    }

    if (body.data.categoryId) {
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.id, body.data.categoryId), eq(categories.householdId, household.id)),
        )
        .limit(1);
      if (cat.length === 0) return reply.code(400).send({ error: 'category not found' });
    }

    const patch: Record<string, unknown> = { autoCategorized: false };
    if (body.data.description !== undefined) patch.description = body.data.description;
    if (body.data.merchant !== undefined) patch.merchant = body.data.merchant;
    if (body.data.notes !== undefined) patch.notes = body.data.notes;
    if (body.data.tags !== undefined) patch.tags = body.data.tags;
    if (body.data.categoryId !== undefined) patch.categoryId = body.data.categoryId;

    const updated = await db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.id, req.params.id), eq(transactions.householdId, household.id)))
      .returning();

    if (updated.length === 0) return reply.code(404).send({ error: 'not found' });
    return updated[0];
  });

  app.get('/transactions/by-category', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    const { month, accountId } = parsed.data;

    const conditions = [eq(transactions.householdId, household.id)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }

    const rows = await db
      .select({
        categoryId: categories.id,
        slug: categories.slug,
        name: categories.name,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(categories.id, categories.slug, categories.name);

    return rows;
  });

  app.get('/transactions/summary', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    const { month, accountId } = parsed.data;

    const conditions = [eq(transactions.householdId, household.id)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }

    const totals = await db
      .select({
        expenses: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), '0')`,
        income: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), '0')`,
        txnCount: sql<number>`cast(count(*) as int)`,
      })
      .from(transactions)
      .where(and(...conditions));

    const uncatRows = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(transactions)
      .where(and(...conditions, isNull(transactions.categoryId)));

    const topCatRows = await db
      .select({
        categoryId: categories.id,
        slug: categories.slug,
        name: categories.name,
        total: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), '0')`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(categories.id, categories.slug, categories.name)
      .orderBy(
        sql`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0) desc`,
      )
      .limit(1);

    const t = totals[0] ?? { expenses: '0', income: '0', txnCount: 0 };
    const expensesNum = Number(t.expenses);
    const incomeNum = Number(t.income);
    const top = topCatRows[0];
    const largestCategory =
      top && Number(top.total) > 0
        ? {
            categoryId: top.categoryId,
            slug: top.slug,
            name: top.name,
            total: top.total,
          }
        : null;

    return {
      month: month ?? null,
      accountId: accountId ?? null,
      income: incomeNum.toFixed(2),
      expenses: expensesNum.toFixed(2),
      net: (incomeNum - expensesNum).toFixed(2),
      txnCount: t.txnCount,
      uncategorizedCount: uncatRows[0]?.count ?? 0,
      largestCategory,
    };
  });

  app.get('/transactions/by-month', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = monthRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    let { from, to } = parsed.data;
    const { accountId } = parsed.data;

    if (!to) {
      const now = new Date();
      to = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    if (!from) from = addMonths(to, -11);

    const fromBounds = monthBounds(from);
    const toBounds = monthBounds(to);

    const conditions = [
      eq(transactions.householdId, household.id),
      gte(transactions.transactionDate, fromBounds.start),
      lt(transactions.transactionDate, toBounds.end),
    ];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));

    const monthExpr = sql<string>`to_char(${transactions.transactionDate}, 'YYYY-MM')`;

    const rows = await db
      .select({
        month: monthExpr,
        expenses: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), '0')`,
        income: sql<string>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), '0')`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(monthExpr)
      .orderBy(monthExpr);

    const byMonth = new Map(rows.map((r) => [r.month, r]));
    const out: { month: string; income: string; expenses: string }[] = [];
    let cursor = from;
    while (cursor <= to) {
      const r = byMonth.get(cursor);
      out.push({
        month: cursor,
        income: r ? r.income : '0',
        expenses: r ? r.expenses : '0',
      });
      cursor = addMonths(cursor, 1);
    }
    return out;
  });

  app.get('/transactions/top-merchants', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = topMerchantsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }
    const { month, accountId, limit } = parsed.data;

    const conditions = [eq(transactions.householdId, household.id)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }

    const rows = await db
      .select({
        key: transactions.description,
        total: sql<string>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), '0')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(transactions)
      .where(and(...conditions, sql`${transactions.amount} > 0`))
      .groupBy(transactions.description)
      .orderBy(
        sql`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0) desc`,
      )
      .limit(limit ?? 10);

    return rows;
  });
};

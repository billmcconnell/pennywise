import type { FastifyPluginAsync } from 'fastify';
import { alias } from 'drizzle-orm/pg-core';
import { and, count, desc, eq, gte, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { transactionUpdateSchema } from '@pennywise/shared';
import type { Db } from '../db/client.js';
import { accounts, categories, transactionEdits, transactions } from '../db/schema.js';

const PAGE_SIZE = 50;

const listQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  accountId: z.string().uuid().optional(),
  q: z.string().min(1).max(200).optional(),
  tag: z.string().min(1).max(100).optional(),
  categoryId: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
    const { month, accountId, q, tag, categoryId, limit, offset } = parsed.data;
    const pageSize = limit ?? PAGE_SIZE;
    const pageOffset = offset ?? 0;

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

    const where = and(...conditions);

    const [totalResult, rows] = await Promise.all([
      db.select({ total: count() }).from(transactions).where(where),
      db
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
        .where(where)
        .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
        .limit(pageSize)
        .offset(pageOffset),
    ]);

    const total = totalResult[0]?.total ?? 0;
    return { rows, total, hasMore: pageOffset + pageSize < total };
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

    // Fetch current state for diff recording
    const currentRows = await db
      .select({
        description: transactions.description,
        merchant: transactions.merchant,
        notes: transactions.notes,
        tags: transactions.tags,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.id, req.params.id), eq(transactions.householdId, household.id)))
      .limit(1);

    if (currentRows.length === 0) return reply.code(404).send({ error: 'not found' });
    const current = currentRows[0]!;

    if (body.data.categoryId) {
      const cat = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(
          and(eq(categories.id, body.data.categoryId), eq(categories.householdId, household.id)),
        )
        .limit(1);
      if (cat.length === 0) return reply.code(400).send({ error: 'category not found' });
    }

    const patch: Record<string, unknown> = { autoCategorized: false };
    const diffs: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    if (body.data.description !== undefined && body.data.description !== current.description) {
      patch.description = body.data.description;
      diffs.push({ field: 'description', oldValue: current.description, newValue: body.data.description });
    }
    if (body.data.merchant !== undefined && body.data.merchant !== current.merchant) {
      patch.merchant = body.data.merchant;
      diffs.push({ field: 'merchant', oldValue: current.merchant, newValue: body.data.merchant ?? null });
    }
    if (body.data.notes !== undefined && body.data.notes !== current.notes) {
      patch.notes = body.data.notes;
      diffs.push({ field: 'notes', oldValue: current.notes, newValue: body.data.notes ?? null });
    }
    if (body.data.tags !== undefined) {
      const oldStr = [...current.tags].sort().join('\0');
      const newStr = [...body.data.tags].sort().join('\0');
      if (oldStr !== newStr) {
        patch.tags = body.data.tags;
        diffs.push({
          field: 'tags',
          oldValue: current.tags.join(', ') || null,
          newValue: body.data.tags.join(', ') || null,
        });
      }
    }
    if (body.data.categoryId !== undefined && body.data.categoryId !== current.categoryId) {
      patch.categoryId = body.data.categoryId;
      let newCatName: string | null = null;
      if (body.data.categoryId) {
        const row = await db
          .select({ name: categories.name })
          .from(categories)
          .where(eq(categories.id, body.data.categoryId))
          .limit(1);
        newCatName = row[0]?.name ?? null;
      }
      diffs.push({ field: 'category', oldValue: current.categoryName, newValue: newCatName });
    }

    const updated = await db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.id, req.params.id), eq(transactions.householdId, household.id)))
      .returning();

    if (updated.length === 0) return reply.code(404).send({ error: 'not found' });

    if (diffs.length > 0) {
      await db.insert(transactionEdits).values(
        diffs.map((d) => ({
          transactionId: req.params.id,
          householdId: household.id,
          field: d.field,
          oldValue: d.oldValue,
          newValue: d.newValue,
        })),
      );
    }

    return updated[0];
  });

  app.get<{ Params: { id: string } }>('/transactions/:id/history', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const rows = await db
      .select({
        id: transactionEdits.id,
        field: transactionEdits.field,
        oldValue: transactionEdits.oldValue,
        newValue: transactionEdits.newValue,
        editedAt: transactionEdits.editedAt,
      })
      .from(transactionEdits)
      .where(
        and(
          eq(transactionEdits.transactionId, req.params.id),
          eq(transactionEdits.householdId, household.id),
        ),
      )
      .orderBy(desc(transactionEdits.editedAt));

    return rows;
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

  app.get('/transactions/category-trends', async (req, reply) => {
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

    const parentCats = alias(categories, 'parent_cats');

    const conditions = [
      eq(transactions.householdId, household.id),
      gte(transactions.transactionDate, fromBounds.start),
      lt(transactions.transactionDate, toBounds.end),
      sql`${transactions.amount} > 0`,
    ];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));

    const monthExpr = sql<string>`to_char(${transactions.transactionDate}, 'YYYY-MM')`;
    const slugExpr = sql<string>`coalesce(${parentCats.slug}, ${categories.slug}, 'uncategorized')`;
    const nameExpr = sql<string>`coalesce(${parentCats.name}, ${categories.name}, 'Uncategorized')`;

    const rows = await db
      .select({
        month: monthExpr,
        slug: slugExpr,
        name: nameExpr,
        total: sql<string>`coalesce(sum(${transactions.amount}), '0')`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCats, eq(categories.parentId, parentCats.id))
      .where(and(...conditions))
      .groupBy(monthExpr, slugExpr, nameExpr)
      .orderBy(monthExpr);

    return rows;
  });

  app.get('/transactions/insights', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad query', detail: parsed.error.flatten() });
    }

    const now = new Date();
    const currentMonth =
      parsed.data.month ??
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const priorMonth = addMonths(currentMonth, -1);
    const { accountId } = parsed.data;

    const { start: curStart, end: curEnd } = monthBounds(currentMonth);
    const { start: priorStart, end: priorEnd } = monthBounds(priorMonth);
    const { start: threeStart } = monthBounds(addMonths(currentMonth, -2));

    const baseConditions = [eq(transactions.householdId, household.id)];
    if (accountId) baseConditions.push(eq(transactions.accountId, accountId));

    // 1. Uncategorized expense count for current month
    const uncatRows = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(transactions)
      .where(
        and(
          ...baseConditions,
          gte(transactions.transactionDate, curStart),
          lt(transactions.transactionDate, curEnd),
          isNull(transactions.categoryId),
          sql`${transactions.amount} > 0`,
        ),
      );
    const uncategorizedCount = uncatRows[0]?.count ?? 0;

    // 2. Top-level category spend for current and prior month
    const parentCats = alias(categories, 'parent_cats_ins');
    const slugExpr = sql<string>`coalesce(${parentCats.slug}, ${categories.slug}, 'uncategorized')`;
    const nameExpr = sql<string>`coalesce(${parentCats.name}, ${categories.name}, 'Uncategorized')`;

    const queryCatTotals = (start: string, end: string) =>
      db
        .select({
          slug: slugExpr,
          name: nameExpr,
          total: sql<string>`coalesce(sum(${transactions.amount}), '0')`,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(parentCats, eq(categories.parentId, parentCats.id))
        .where(
          and(
            ...baseConditions,
            gte(transactions.transactionDate, start),
            lt(transactions.transactionDate, end),
            sql`${transactions.amount} > 0`,
          ),
        )
        .groupBy(slugExpr, nameExpr)
        .orderBy(sql`sum(${transactions.amount}) desc`);

    const [curCatRows, priorCatRows] = await Promise.all([
      queryCatTotals(curStart, curEnd),
      queryCatTotals(priorStart, priorEnd),
    ]);

    const priorBySlug = new Map(priorCatRows.map((r) => [r.slug, Number(r.total)]));

    const topCategory = (() => {
      const top = curCatRows.find(
        (r) => r.slug !== 'uncategorized' && r.slug !== 'income' && Number(r.total) > 0,
      );
      if (!top) return null;
      const currentTotal = Number(top.total);
      const priorTotal = priorBySlug.get(top.slug) ?? 0;
      const changePct = priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : null;
      return {
        name: top.name,
        slug: top.slug,
        currentTotal: currentTotal.toFixed(2),
        priorTotal: priorTotal.toFixed(2),
        changePct: changePct !== null ? Math.round(changePct) : null,
      };
    })();

    // 3. Largest recurring merchant (appears in 2+ of last 3 months)
    const merchantRows = await db
      .select({
        merchant: transactions.description,
        month: sql<string>`to_char(${transactions.transactionDate}, 'YYYY-MM')`,
        monthlyTotal: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          ...baseConditions,
          gte(transactions.transactionDate, threeStart),
          lt(transactions.transactionDate, curEnd),
          sql`${transactions.amount} > 0`,
        ),
      )
      .groupBy(transactions.description, sql`to_char(${transactions.transactionDate}, 'YYYY-MM')`);

    const merchantMonths = new Map<string, number[]>();
    for (const r of merchantRows) {
      const arr = merchantMonths.get(r.merchant) ?? [];
      arr.push(Number(r.monthlyTotal));
      merchantMonths.set(r.merchant, arr);
    }

    let largestRecurring: {
      merchant: string;
      avgMonthlyTotal: string;
      monthCount: number;
    } | null = null;
    let bestAvg = 0;
    for (const [merchant, totals] of merchantMonths) {
      if (totals.length < 2) continue;
      const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
      if (avg > bestAvg) {
        bestAvg = avg;
        largestRecurring = {
          merchant,
          avgMonthlyTotal: avg.toFixed(2),
          monthCount: totals.length,
        };
      }
    }

    return { uncategorizedCount, topCategory, largestRecurring };
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

  app.get('/transactions/tags', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const rows = await db
      .select({ tag: sql<string>`unnest(${transactions.tags})` })
      .from(transactions)
      .where(eq(transactions.householdId, household.id));

    const unique = [...new Set(rows.map((r) => r.tag))].filter(Boolean).sort();
    return unique;
  });

  app.get('/transactions/months', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const rows = await db
      .selectDistinct({
        month: sql<string>`to_char(${transactions.transactionDate}::date, 'YYYY-MM')`,
      })
      .from(transactions)
      .where(eq(transactions.householdId, household.id))
      .orderBy(sql`1 DESC`);

    return rows.map((r) => r.month);
  });
};

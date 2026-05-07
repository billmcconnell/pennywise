import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gt, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { accounts, budgets, categories, transactions } from '../db/schema.js';

const statusQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  accountId: z.string().uuid().optional(),
});

const historyQuerySchema = z.object({
  endMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  months: z.coerce.number().int().min(1).max(12).optional(),
  accountId: z.string().uuid().optional(),
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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export const budgetRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  // List all budgets with category info
  app.get('/budgets', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    return db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        amount: budgets.amount,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.householdId, household.id))
      .orderBy(categories.name);
  });

  // Budget status — budgets joined with actual spending for a period
  app.get('/budgets/status', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = statusQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad query' });
    const { month, accountId } = parsed.data;

    const budgetRows = await db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        amount: budgets.amount,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.householdId, household.id));

    if (budgetRows.length === 0) return [];

    // Gather actual spending per category (with parentId) for the period
    const conditions = [
      eq(transactions.householdId, household.id),
      gt(transactions.amount, '0'),
    ];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (month) {
      const { start, end } = monthBounds(month);
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }

    const actuals = await db
      .select({
        categoryId: transactions.categoryId,
        parentId: categories.parentId,
        total: sql<string>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(transactions.categoryId, categories.parentId);

    // Join in application code: match direct category or sub-category
    return budgetRows
      .map((b) => {
        const actual = actuals
          .filter((a) => a.categoryId === b.categoryId || a.parentId === b.categoryId)
          .reduce((sum, a) => sum + Number(a.total), 0);
        const budget = Number(b.amount);
        const remaining = budget - actual;
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
        return {
          categoryId: b.categoryId,
          categoryName: b.categoryName,
          categorySlug: b.categorySlug,
          budget: b.amount,
          actual: actual.toFixed(2),
          remaining: remaining.toFixed(2),
          pct,
          isOver: actual > budget,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  });

  // Budget history — budget vs actual across multiple months
  app.get('/budgets/history', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad query' });
    const { accountId } = parsed.data;
    const numMonths = parsed.data.months ?? 6;
    const end = parsed.data.endMonth ?? currentMonth();

    const budgetRows = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        amount: budgets.amount,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.householdId, household.id))
      .orderBy(categories.name);

    if (budgetRows.length === 0) return [];

    // Build the ordered list of months
    const monthsList: string[] = [];
    for (let i = numMonths - 1; i >= 0; i--) {
      monthsList.push(addMonths(end, -i));
    }

    // Single query: actuals for the full range, grouped by (categoryId, parentId, month)
    const rangeStart = monthBounds(monthsList[0]!).start;
    const rangeEnd = monthBounds(monthsList[monthsList.length - 1]!).end;

    const conditions = [
      eq(transactions.householdId, household.id),
      gt(transactions.amount, '0'),
      gte(transactions.transactionDate, rangeStart),
      lt(transactions.transactionDate, rangeEnd),
    ];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));

    const actuals = await db
      .select({
        categoryId: transactions.categoryId,
        parentId: categories.parentId,
        month: sql<string>`to_char(${transactions.transactionDate}::date, 'YYYY-MM')`,
        total: sql<string>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(
        transactions.categoryId,
        categories.parentId,
        sql`to_char(${transactions.transactionDate}::date, 'YYYY-MM')`,
      );

    return budgetRows.map((b) => {
      const months = monthsList.map((month) => {
        const actual = actuals
          .filter(
            (a) =>
              (a.categoryId === b.categoryId || a.parentId === b.categoryId) &&
              a.month === month,
          )
          .reduce((sum, a) => sum + Number(a.total), 0);
        const budget = Number(b.amount);
        const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
        return { month, actual: actual.toFixed(2), pct, isOver: actual > budget };
      });
      return {
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        categorySlug: b.categorySlug,
        budget: b.amount,
        months,
      };
    });
  });

  // Upsert budget for a category
  app.put<{ Params: { categoryId: string } }>('/budgets/:categoryId', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.categoryId);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad categoryId' });

    const body = z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'amount must be a positive decimal' });

    // Verify category belongs to this household
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, req.params.categoryId), eq(categories.householdId, household.id)))
      .limit(1);
    if (cat.length === 0) return reply.code(404).send({ error: 'category not found' });

    const [row] = await db
      .insert(budgets)
      .values({
        householdId: household.id,
        categoryId: req.params.categoryId,
        amount: body.data.amount,
      })
      .onConflictDoUpdate({
        target: [budgets.householdId, budgets.categoryId],
        set: { amount: body.data.amount, updatedAt: new Date() },
      })
      .returning();

    return row;
  });

  // Delete budget for a category
  app.delete<{ Params: { categoryId: string } }>('/budgets/:categoryId', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.categoryId);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad categoryId' });

    await db
      .delete(budgets)
      .where(
        and(
          eq(budgets.householdId, household.id),
          eq(budgets.categoryId, req.params.categoryId),
        ),
      );

    return reply.code(204).send();
  });
};

import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { categories, recurringBills, transactions } from '../db/schema.js';

const billBodySchema = z.object({
  name: z.string().min(1).max(200),
  matchPattern: z.string().min(1).max(200),
  expectedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
});

const statusQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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

export const billRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  // List all active bills
  app.get('/bills', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    return db
      .select({
        id: recurringBills.id,
        name: recurringBills.name,
        matchPattern: recurringBills.matchPattern,
        expectedAmount: recurringBills.expectedAmount,
        categoryId: recurringBills.categoryId,
        categoryName: categories.name,
        dueDay: recurringBills.dueDay,
        isActive: recurringBills.isActive,
        createdAt: recurringBills.createdAt,
      })
      .from(recurringBills)
      .leftJoin(categories, eq(recurringBills.categoryId, categories.id))
      .where(
        and(eq(recurringBills.householdId, household.id), eq(recurringBills.isActive, true)),
      )
      .orderBy(recurringBills.name);
  });

  // Bill status for a month — each bill with paid/pending info
  app.get('/bills/status', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = statusQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad query' });
    const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);

    const bills = await db
      .select({
        id: recurringBills.id,
        name: recurringBills.name,
        matchPattern: recurringBills.matchPattern,
        expectedAmount: recurringBills.expectedAmount,
        categoryId: recurringBills.categoryId,
        categoryName: categories.name,
        dueDay: recurringBills.dueDay,
      })
      .from(recurringBills)
      .leftJoin(categories, eq(recurringBills.categoryId, categories.id))
      .where(
        and(eq(recurringBills.householdId, household.id), eq(recurringBills.isActive, true)),
      )
      .orderBy(recurringBills.dueDay, recurringBills.name);

    if (bills.length === 0) return [];

    const { start, end } = monthBounds(month);
    const txns = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        originalDescription: transactions.originalDescription,
        merchant: transactions.merchant,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          gte(transactions.transactionDate, start),
          lt(transactions.transactionDate, end),
          sql`${transactions.amount} > 0`,
        ),
      );

    return bills.map((bill) => {
      const pat = bill.matchPattern.toLowerCase();
      const match = txns.find(
        (t) =>
          t.description.toLowerCase().includes(pat) ||
          t.originalDescription.toLowerCase().includes(pat) ||
          (t.merchant?.toLowerCase().includes(pat) ?? false),
      );
      return {
        ...bill,
        paid: !!match,
        paidAmount: match?.amount ?? null,
        paidDate: match?.transactionDate ?? null,
        transactionId: match?.id ?? null,
      };
    });
  });

  // Suggested recurring merchants not yet tracked
  app.get('/bills/suggestions', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = statusQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad query' });
    const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);

    const threeStart = monthBounds(addMonths(month, -3)).start;
    const curEnd = monthBounds(month).end;

    // Descriptions appearing in 2+ of the last 3 months with positive amounts
    const rows = await db
      .select({
        pattern: transactions.description,
        monthCount: sql<number>`COUNT(DISTINCT to_char(${transactions.transactionDate}::date, 'YYYY-MM'))`,
        avgAmount: sql<string>`AVG(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          gte(transactions.transactionDate, threeStart),
          lt(transactions.transactionDate, curEnd),
          sql`${transactions.amount} > 0`,
        ),
      )
      .groupBy(transactions.description)
      .having(
        sql`COUNT(DISTINCT to_char(${transactions.transactionDate}::date, 'YYYY-MM')) >= 2`,
      )
      .orderBy(sql`AVG(${transactions.amount}) DESC`)
      .limit(20);

    // Filter out patterns already tracked
    const tracked = await db
      .select({ matchPattern: recurringBills.matchPattern })
      .from(recurringBills)
      .where(
        and(eq(recurringBills.householdId, household.id), eq(recurringBills.isActive, true)),
      );
    const trackedPatterns = new Set(tracked.map((t) => t.matchPattern.toLowerCase()));

    return rows
      .filter((r) => !trackedPatterns.has(r.pattern.toLowerCase()))
      .slice(0, 10);
  });

  // Create bill
  app.post('/bills', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const body = billBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });

    const [row] = await db
      .insert(recurringBills)
      .values({
        householdId: household.id,
        name: body.data.name,
        matchPattern: body.data.matchPattern,
        expectedAmount: body.data.expectedAmount ?? null,
        categoryId: body.data.categoryId ?? null,
        dueDay: body.data.dueDay ?? null,
      })
      .returning();

    return reply.code(201).send(row);
  });

  // Update bill
  app.patch<{ Params: { id: string } }>('/bills/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const body = billBodySchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });

    const [row] = await db
      .update(recurringBills)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(eq(recurringBills.id, req.params.id), eq(recurringBills.householdId, household.id)),
      )
      .returning();

    if (!row) return reply.code(404).send({ error: 'not found' });
    return row;
  });

  // Delete (soft — sets isActive = false)
  app.delete<{ Params: { id: string } }>('/bills/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    await db
      .update(recurringBills)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(recurringBills.id, req.params.id), eq(recurringBills.householdId, household.id)),
      );

    return reply.code(204).send();
  });
};

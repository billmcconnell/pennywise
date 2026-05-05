import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { categories, transactions } from '../db/schema.js';

const listQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  accountId: z.string().uuid().optional(),
});

const patchBodySchema = z.object({
  categoryId: z.string().uuid().nullable(),
});

export const transactionRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/transactions', async (req, reply) => {
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
      const [y, m] = month.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextMonth = m === 12 ? 1 : m! + 1;
      const nextYear = m === 12 ? y! + 1 : y;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      conditions.push(gte(transactions.transactionDate, start));
      conditions.push(lt(transactions.transactionDate, end));
    }

    const rows = await db
      .select({
        id: transactions.id,
        transactionDate: transactions.transactionDate,
        amount: transactions.amount,
        description: transactions.description,
        originalDescription: transactions.originalDescription,
        accountId: transactions.accountId,
        categoryId: transactions.categoryId,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));

    return rows;
  });

  app.patch<{ Params: { id: string } }>('/transactions/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const body = patchBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });
    }

    const updated = await db
      .update(transactions)
      .set({ categoryId: body.data.categoryId, autoCategorized: false })
      .where(
        and(eq(transactions.id, req.params.id), eq(transactions.householdId, household.id)),
      )
      .returning({ id: transactions.id, categoryId: transactions.categoryId });

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
      const [y, m] = month.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const nextMonth = m === 12 ? 1 : m! + 1;
      const nextYear = m === 12 ? y! + 1 : y;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
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
};

import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { accountCreateSchema, accountUpdateSchema } from '@pennywise/shared';
import type { Db } from '../db/client.js';
import { accounts, transactions } from '../db/schema.js';

const includeArchivedSchema = z.object({
  includeArchived: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional(),
});

export const accountRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/accounts', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = includeArchivedSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'bad query' });
    const includeArchived =
      parsed.data.includeArchived === 'true' || parsed.data.includeArchived === '1';

    const conditions = [eq(accounts.householdId, household.id)];
    if (!includeArchived) conditions.push(isNull(accounts.archivedAt));

    const sumAmount = sql<string>`coalesce((
      select sum(${transactions.amount})
      from ${transactions}
      where ${transactions.accountId} = ${accounts.id}
    ), 0)::text`;

    const rows = await db
      .select({
        id: accounts.id,
        householdId: accounts.householdId,
        name: accounts.name,
        type: accounts.type,
        institution: accounts.institution,
        lastFour: accounts.lastFour,
        openingBalance: accounts.openingBalance,
        currencyCode: accounts.currencyCode,
        archivedAt: accounts.archivedAt,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        sumAmount,
      })
      .from(accounts)
      .where(and(...conditions))
      .orderBy(asc(accounts.name));

    return rows.map((r) => {
      const opening = Number(r.openingBalance);
      const sum = Number(r.sumAmount);
      const currentBalance = (opening + sum).toFixed(2);
      return {
        id: r.id,
        householdId: r.householdId,
        name: r.name,
        type: r.type,
        institution: r.institution,
        lastFour: r.lastFour,
        openingBalance: r.openingBalance,
        currencyCode: r.currencyCode,
        archivedAt: r.archivedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        currentBalance,
      };
    });
  });

  app.post('/accounts', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = accountCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad body', detail: parsed.error.flatten() });
    }
    const body = parsed.data;

    const inserted = await db
      .insert(accounts)
      .values({
        householdId: household.id,
        name: body.name,
        type: body.type,
        institution: body.institution ?? null,
        lastFour: body.lastFour ?? null,
        openingBalance: body.openingBalance ?? '0',
        currencyCode: body.currencyCode ?? 'USD',
      })
      .returning();

    return reply.code(201).send(inserted[0]);
  });

  app.patch<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const parsed = accountUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad body', detail: parsed.error.flatten() });
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.type !== undefined) patch.type = parsed.data.type;
    if (parsed.data.institution !== undefined) patch.institution = parsed.data.institution;
    if (parsed.data.lastFour !== undefined) patch.lastFour = parsed.data.lastFour;
    if (parsed.data.openingBalance !== undefined) patch.openingBalance = parsed.data.openingBalance;
    if (parsed.data.currencyCode !== undefined) patch.currencyCode = parsed.data.currencyCode;

    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: 'no fields to update' });
    }

    const updated = await db
      .update(accounts)
      .set(patch)
      .where(and(eq(accounts.id, req.params.id), eq(accounts.householdId, household.id)))
      .returning();

    if (updated.length === 0) return reply.code(404).send({ error: 'not found' });
    return updated[0];
  });

  app.delete<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const updated = await db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(accounts.id, req.params.id),
          eq(accounts.householdId, household.id),
          isNull(accounts.archivedAt),
        ),
      )
      .returning({ id: accounts.id });

    if (updated.length === 0) return reply.code(404).send({ error: 'not found' });
    return reply.code(204).send();
  });
};

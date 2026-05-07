import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { savingsGoals } from '../db/schema.js';

const goalBodySchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const contributionSchema = z.object({
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
});

function computeStatus(goal: {
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  createdAt: Date;
}) {
  const target = Number(goal.targetAmount);
  const current = Number(goal.currentAmount);
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const remaining = Math.max(target - current, 0);

  let daysRemaining: number | null = null;
  let onTrack: boolean | null = null;

  if (goal.targetDate) {
    const now = new Date();
    const due = new Date(goal.targetDate);
    daysRemaining = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);

    const totalDays = Math.ceil(
      (due.getTime() - goal.createdAt.getTime()) / 86_400_000,
    );
    const elapsed = totalDays - daysRemaining;
    const expectedCurrent = totalDays > 0 ? (elapsed / totalDays) * target : 0;
    onTrack = current >= expectedCurrent;
  }

  return { pct, remaining: remaining.toFixed(2), daysRemaining, onTrack };
}

export const goalRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  // List all active goals with computed status
  app.get('/goals', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const rows = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.householdId, household.id), eq(savingsGoals.isActive, true)))
      .orderBy(savingsGoals.targetDate, savingsGoals.name);

    return rows.map((g) => ({ ...g, ...computeStatus(g) }));
  });

  // Create goal
  app.post('/goals', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const body = goalBodySchema.safeParse(req.body);
    if (!body.success)
      return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });

    const [row] = await db
      .insert(savingsGoals)
      .values({
        householdId: household.id,
        name: body.data.name,
        targetAmount: body.data.targetAmount,
        targetDate: body.data.targetDate ?? null,
        notes: body.data.notes ?? null,
      })
      .returning();

    return reply.code(201).send({ ...row, ...computeStatus(row!) });
  });

  // Update goal fields
  app.patch<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const body = goalBodySchema.partial().safeParse(req.body);
    if (!body.success)
      return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });

    const [row] = await db
      .update(savingsGoals)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.householdId, household.id)),
      )
      .returning();

    if (!row) return reply.code(404).send({ error: 'not found' });
    return { ...row, ...computeStatus(row) };
  });

  // Add or subtract a contribution (updates currentAmount)
  app.post<{ Params: { id: string } }>('/goals/:id/contribute', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const body = contributionSchema.safeParse(req.body);
    if (!body.success)
      return reply.code(400).send({ error: 'bad body', detail: body.error.flatten() });

    const [current] = await db
      .select({ currentAmount: savingsGoals.currentAmount })
      .from(savingsGoals)
      .where(
        and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.householdId, household.id)),
      )
      .limit(1);

    if (!current) return reply.code(404).send({ error: 'not found' });

    const newAmount = Math.max(0, Number(current.currentAmount) + Number(body.data.amount));

    const [row] = await db
      .update(savingsGoals)
      .set({ currentAmount: newAmount.toFixed(2), updatedAt: new Date() })
      .where(
        and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.householdId, household.id)),
      )
      .returning();

    return { ...row!, ...computeStatus(row!) };
  });

  // Soft delete
  app.delete<{ Params: { id: string } }>('/goals/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    await db
      .update(savingsGoals)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(savingsGoals.id, req.params.id), eq(savingsGoals.householdId, household.id)),
      );

    return reply.code(204).send();
  });
};

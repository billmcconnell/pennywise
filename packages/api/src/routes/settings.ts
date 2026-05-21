import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { households } from '../db/schema.js';

export interface HouseholdPreferences {
  defaultPeriod: 'current' | 'previous' | 'latest_data';
  chartMonths: 3 | 6 | 12;
}

const DEFAULTS: HouseholdPreferences = {
  defaultPeriod: 'latest_data',
  chartMonths: 12,
};

export const settingsRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/settings', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const [row] = await db
      .select({ preferences: households.preferences })
      .from(households)
      .where(eq(households.id, household.id))
      .limit(1);

    return { ...DEFAULTS, ...(row?.preferences ?? {}) } as HouseholdPreferences;
  });

  app.patch('/settings', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });
    if (req.user?.role !== 'admin') return reply.code(403).send({ error: 'admin required' });

    const body = req.body as Partial<HouseholdPreferences>;

    const [current] = await db
      .select({ preferences: households.preferences })
      .from(households)
      .where(eq(households.id, household.id))
      .limit(1);

    const merged = { ...DEFAULTS, ...(current?.preferences ?? {}), ...body };

    await db
      .update(households)
      .set({ preferences: merged })
      .where(eq(households.id, household.id));

    return merged as HouseholdPreferences;
  });
};

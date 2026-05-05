import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { categories } from '../db/schema.js';

export const categoryRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/categories', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        parentId: categories.parentId,
        isSystem: categories.isSystem,
      })
      .from(categories)
      .where(and(eq(categories.householdId, household.id), isNull(categories.archivedAt)))
      .orderBy(asc(categories.slug));

    return rows;
  });
};

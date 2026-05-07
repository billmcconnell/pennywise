import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { categories, transactions } from '../db/schema.js';

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

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

  app.post('/categories', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const body = z
      .object({ name: z.string().min(1).max(80).trim(), parentId: z.string().uuid() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad body' });

    const { name, parentId } = body.data;

    const [parent] = await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(
        and(
          eq(categories.id, parentId),
          eq(categories.householdId, household.id),
          isNull(categories.parentId),
          isNull(categories.archivedAt),
        ),
      )
      .limit(1);
    if (!parent) return reply.code(400).send({ error: 'parent not found or not top-level' });

    const base = `${parent.slug}.${toSlug(name)}`;
    let slug = base;
    let attempt = 2;
    for (;;) {
      const clash = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.householdId, household.id), eq(categories.slug, slug)))
        .limit(1);
      if (clash.length === 0) break;
      slug = `${base}-${attempt++}`;
    }

    const [row] = await db
      .insert(categories)
      .values({ householdId: household.id, slug, name, parentId, isSystem: false })
      .returning();

    return reply.code(201).send(row);
  });

  app.delete<{ Params: { id: string } }>('/categories/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const [cat] = await db
      .select({ id: categories.id, parentId: categories.parentId, isSystem: categories.isSystem })
      .from(categories)
      .where(
        and(
          eq(categories.id, idCheck.data),
          eq(categories.householdId, household.id),
          isNull(categories.archivedAt),
        ),
      )
      .limit(1);
    if (!cat) return reply.code(404).send({ error: 'not found' });
    if (cat.isSystem) return reply.code(403).send({ error: 'cannot delete system categories' });
    if (!cat.parentId) return reply.code(403).send({ error: 'cannot delete top-level categories' });

    await db
      .update(transactions)
      .set({ categoryId: cat.parentId, autoCategorized: false })
      .where(and(eq(transactions.householdId, household.id), eq(transactions.categoryId, cat.id)));

    await db.delete(categories).where(eq(categories.id, cat.id));

    return reply.code(204).send();
  });
};

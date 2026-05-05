import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  ruleApplyBodySchema,
  ruleCreateSchema,
  ruleUpdateSchema,
} from '@pennywise/shared';
import type { Db } from '../db/client.js';
import { categories, categorizationRules, transactions } from '../db/schema.js';
import { applyRules, sortRules, type RuleLike } from '../ingest/rules-engine.js';

function validateRegex(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export const ruleRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/rules', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const rows = await db
      .select({
        id: categorizationRules.id,
        householdId: categorizationRules.householdId,
        matchType: categorizationRules.matchType,
        pattern: categorizationRules.pattern,
        caseInsensitive: categorizationRules.caseInsensitive,
        categoryId: categorizationRules.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        priority: categorizationRules.priority,
        enabled: categorizationRules.enabled,
        createdAt: categorizationRules.createdAt,
        updatedAt: categorizationRules.updatedAt,
      })
      .from(categorizationRules)
      .leftJoin(categories, eq(categorizationRules.categoryId, categories.id))
      .where(eq(categorizationRules.householdId, household.id))
      .orderBy(desc(categorizationRules.priority), asc(categorizationRules.createdAt));

    return rows;
  });

  app.post('/rules', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = ruleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad body', detail: parsed.error.flatten() });
    }
    const body = parsed.data;

    if (body.matchType === 'description_regex') {
      const err = validateRegex(body.pattern);
      if (err) return reply.code(400).send({ error: 'invalid regex', detail: err });
    }

    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, body.categoryId), eq(categories.householdId, household.id)))
      .limit(1);
    if (cat.length === 0) return reply.code(400).send({ error: 'category not found' });

    const inserted = await db
      .insert(categorizationRules)
      .values({
        householdId: household.id,
        matchType: body.matchType,
        pattern: body.pattern,
        caseInsensitive: body.caseInsensitive ?? true,
        categoryId: body.categoryId,
        priority: body.priority ?? 0,
        enabled: body.enabled ?? true,
      })
      .returning();

    return reply.code(201).send(inserted[0]);
  });

  app.patch<{ Params: { id: string } }>('/rules/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const parsed = ruleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad body', detail: parsed.error.flatten() });
    }

    if (parsed.data.matchType === 'description_regex' && parsed.data.pattern) {
      const err = validateRegex(parsed.data.pattern);
      if (err) return reply.code(400).send({ error: 'invalid regex', detail: err });
    }

    if (parsed.data.categoryId) {
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(eq(categories.id, parsed.data.categoryId), eq(categories.householdId, household.id)),
        )
        .limit(1);
      if (cat.length === 0) return reply.code(400).send({ error: 'category not found' });
    }

    const patch: Record<string, unknown> = {};
    for (const k of [
      'matchType',
      'pattern',
      'caseInsensitive',
      'categoryId',
      'priority',
      'enabled',
    ] as const) {
      if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
    }
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: 'no fields to update' });
    }

    const updated = await db
      .update(categorizationRules)
      .set(patch)
      .where(
        and(
          eq(categorizationRules.id, req.params.id),
          eq(categorizationRules.householdId, household.id),
        ),
      )
      .returning();

    if (updated.length === 0) return reply.code(404).send({ error: 'not found' });
    return updated[0];
  });

  app.delete<{ Params: { id: string } }>('/rules/:id', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) return reply.code(400).send({ error: 'bad id' });

    const deleted = await db
      .delete(categorizationRules)
      .where(
        and(
          eq(categorizationRules.id, req.params.id),
          eq(categorizationRules.householdId, household.id),
        ),
      )
      .returning({ id: categorizationRules.id });

    if (deleted.length === 0) return reply.code(404).send({ error: 'not found' });
    return reply.code(204).send();
  });

  app.post('/rules/apply', async (req, reply) => {
    const household = req.household;
    if (!household) return reply.code(401).send({ error: 'no household' });

    const parsed = ruleApplyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad body', detail: parsed.error.flatten() });
    }
    const { scope, accountId } = parsed.data;

    const rules = await db
      .select({
        id: categorizationRules.id,
        matchType: categorizationRules.matchType,
        pattern: categorizationRules.pattern,
        caseInsensitive: categorizationRules.caseInsensitive,
        categoryId: categorizationRules.categoryId,
        priority: categorizationRules.priority,
        enabled: categorizationRules.enabled,
      })
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.householdId, household.id),
          eq(categorizationRules.enabled, true),
        ),
      );

    const sorted = sortRules(rules as RuleLike[]);
    if (sorted.length === 0) {
      return { matched: 0, updated: 0, scanned: 0 };
    }

    const conditions = [eq(transactions.householdId, household.id)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (scope === 'uncategorized') {
      conditions.push(isNull(transactions.categoryId));
    } else if (scope === 'auto_categorized') {
      conditions.push(eq(transactions.autoCategorized, true));
    } else if (scope === 'all_unedited') {
      conditions.push(
        sql`(${transactions.categoryId} is null or ${transactions.autoCategorized} = true)`,
      );
    }

    const txns = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        originalDescription: transactions.originalDescription,
        merchant: transactions.merchant,
      })
      .from(transactions)
      .where(and(...conditions));

    let matched = 0;
    let updated = 0;
    for (const t of txns) {
      const m = applyRules(t, sorted);
      if (!m) continue;
      matched += 1;
      const res = await db
        .update(transactions)
        .set({
          categoryId: m.categoryId,
          autoCategorized: true,
          confidenceScore: 1,
        })
        .where(eq(transactions.id, t.id))
        .returning({ id: transactions.id });
      if (res.length > 0) updated += 1;
    }

    return { scanned: txns.length, matched, updated };
  });
};

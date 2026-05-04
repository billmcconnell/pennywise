import { eq, and } from 'drizzle-orm';
import { SEED_CATEGORIES } from '@pennywise/shared';
import { loadConfig } from '../config.js';
import { makeDb } from './client.js';
import { categories, households } from './schema.js';

const DEV_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001';
const DEV_HOUSEHOLD_NAME = 'Dev Household';

async function seed(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = makeDb(config.DATABASE_URL);

  try {
    await db
      .insert(households)
      .values({ id: DEV_HOUSEHOLD_ID, name: DEV_HOUSEHOLD_NAME })
      .onConflictDoNothing({ target: households.id });

    const existing = await db
      .select({ slug: categories.slug, id: categories.id })
      .from(categories)
      .where(eq(categories.householdId, DEV_HOUSEHOLD_ID));
    const bySlug = new Map(existing.map((c) => [c.slug, c.id]));

    for (const seedCat of SEED_CATEGORIES.filter((c) => c.parentSlug === null)) {
      if (bySlug.has(seedCat.slug)) continue;
      const inserted = await db
        .insert(categories)
        .values({
          householdId: DEV_HOUSEHOLD_ID,
          slug: seedCat.slug,
          name: seedCat.name,
          parentId: null,
          isSystem: true,
        })
        .returning({ id: categories.id });
      const insertedId = inserted[0]?.id;
      if (!insertedId) throw new Error(`Insert returned no id for ${seedCat.slug}`);
      bySlug.set(seedCat.slug, insertedId);
    }

    for (const seedCat of SEED_CATEGORIES.filter((c) => c.parentSlug !== null)) {
      if (bySlug.has(seedCat.slug)) continue;
      const parentId = bySlug.get(seedCat.parentSlug!);
      if (!parentId) {
        throw new Error(`Seed parent missing for ${seedCat.slug} (parent ${seedCat.parentSlug})`);
      }
      const inserted = await db
        .insert(categories)
        .values({
          householdId: DEV_HOUSEHOLD_ID,
          slug: seedCat.slug,
          name: seedCat.name,
          parentId,
          isSystem: true,
        })
        .returning({ id: categories.id });
      const insertedId = inserted[0]?.id;
      if (!insertedId) throw new Error(`Insert returned no id for ${seedCat.slug}`);
      bySlug.set(seedCat.slug, insertedId);
    }

    const total = await db
      .select()
      .from(categories)
      .where(and(eq(categories.householdId, DEV_HOUSEHOLD_ID)));
    console.log(`seed ok: household=${DEV_HOUSEHOLD_ID} categories=${total.length}`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});

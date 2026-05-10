import { eq } from 'drizzle-orm';
import { SEED_CATEGORIES } from '@pennywise/shared';
import { categories } from './schema.js';
import type { Db } from './client.js';

export async function seedHousehold(db: Db, householdId: string): Promise<void> {
  const existing = await db
    .select({ slug: categories.slug, id: categories.id })
    .from(categories)
    .where(eq(categories.householdId, householdId));
  const bySlug = new Map(existing.map((c) => [c.slug, c.id]));

  for (const seedCat of SEED_CATEGORIES.filter((c) => c.parentSlug === null)) {
    if (bySlug.has(seedCat.slug)) continue;
    const [inserted] = await db
      .insert(categories)
      .values({ householdId, slug: seedCat.slug, name: seedCat.name, parentId: null, isSystem: true })
      .returning({ id: categories.id });
    if (inserted) bySlug.set(seedCat.slug, inserted.id);
  }

  for (const seedCat of SEED_CATEGORIES.filter((c) => c.parentSlug !== null)) {
    if (bySlug.has(seedCat.slug)) continue;
    const parentId = bySlug.get(seedCat.parentSlug!);
    if (!parentId) throw new Error(`Seed parent missing for ${seedCat.slug}`);
    const [inserted] = await db
      .insert(categories)
      .values({ householdId, slug: seedCat.slug, name: seedCat.name, parentId, isSystem: true })
      .returning({ id: categories.id });
    if (inserted) bySlug.set(seedCat.slug, inserted.id);
  }
}

import { describe, it, expect } from 'vitest';
import { SEED_CATEGORIES, TOP_LEVEL_CATEGORIES } from './categories.js';

describe('seed categories', () => {
  it('contains every PRD §4.4 top-level', () => {
    const tops = SEED_CATEGORIES.filter((c) => c.parentSlug === null).map((c) => c.slug);
    expect(tops.sort()).toEqual([...TOP_LEVEL_CATEGORIES].sort());
  });

  it('every subcategory parent exists as a top-level', () => {
    const tops = new Set(SEED_CATEGORIES.filter((c) => c.parentSlug === null).map((c) => c.slug));
    const orphans = SEED_CATEGORIES.filter(
      (c) => c.parentSlug !== null && !tops.has(c.parentSlug),
    );
    expect(orphans).toEqual([]);
  });

  it('slugs are unique', () => {
    const slugs = SEED_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

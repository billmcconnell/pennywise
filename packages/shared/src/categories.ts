/**
 * Default category seed per PRD §4.4. Top-levels are fixed; subcategories
 * are seeded but user-editable (locked decision #8).
 */

export type SeedCategory = {
  slug: string;
  name: string;
  parentSlug: string | null;
};

export const TOP_LEVEL_CATEGORIES = [
  'housing',
  'transportation',
  'food',
  'healthcare',
  'personal',
  'financial',
  'income',
  'uncategorized',
] as const;

export type TopLevelCategorySlug = (typeof TOP_LEVEL_CATEGORIES)[number];

export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: 'housing', name: 'Housing', parentSlug: null },
  { slug: 'housing.rent-mortgage', name: 'Rent/Mortgage', parentSlug: 'housing' },
  { slug: 'housing.utilities', name: 'Utilities', parentSlug: 'housing' },
  { slug: 'housing.maintenance', name: 'Home Maintenance', parentSlug: 'housing' },
  { slug: 'housing.insurance', name: 'Insurance', parentSlug: 'housing' },

  { slug: 'transportation', name: 'Transportation', parentSlug: null },
  { slug: 'transportation.gas', name: 'Gas', parentSlug: 'transportation' },
  { slug: 'transportation.transit', name: 'Public Transit', parentSlug: 'transportation' },
  { slug: 'transportation.car-payment', name: 'Car Payment', parentSlug: 'transportation' },
  { slug: 'transportation.parking', name: 'Parking', parentSlug: 'transportation' },
  { slug: 'transportation.maintenance', name: 'Maintenance', parentSlug: 'transportation' },

  { slug: 'food', name: 'Food', parentSlug: null },
  { slug: 'food.groceries', name: 'Groceries', parentSlug: 'food' },
  { slug: 'food.restaurants', name: 'Restaurants', parentSlug: 'food' },
  { slug: 'food.coffee', name: 'Coffee Shops', parentSlug: 'food' },
  { slug: 'food.delivery', name: 'Delivery', parentSlug: 'food' },

  { slug: 'healthcare', name: 'Healthcare', parentSlug: null },
  { slug: 'healthcare.medical', name: 'Medical', parentSlug: 'healthcare' },
  { slug: 'healthcare.dental', name: 'Dental', parentSlug: 'healthcare' },
  { slug: 'healthcare.pharmacy', name: 'Pharmacy', parentSlug: 'healthcare' },
  { slug: 'healthcare.insurance', name: 'Insurance', parentSlug: 'healthcare' },

  { slug: 'personal', name: 'Personal', parentSlug: null },
  { slug: 'personal.clothing', name: 'Clothing', parentSlug: 'personal' },
  { slug: 'personal.care', name: 'Personal Care', parentSlug: 'personal' },
  { slug: 'personal.entertainment', name: 'Entertainment', parentSlug: 'personal' },
  { slug: 'personal.subscriptions', name: 'Subscriptions', parentSlug: 'personal' },

  { slug: 'financial', name: 'Financial', parentSlug: null },
  { slug: 'financial.bank-fees', name: 'Bank Fees', parentSlug: 'financial' },
  { slug: 'financial.interest', name: 'Interest', parentSlug: 'financial' },
  { slug: 'financial.transfers', name: 'Transfers', parentSlug: 'financial' },
  { slug: 'financial.investments', name: 'Investments', parentSlug: 'financial' },

  { slug: 'income', name: 'Income', parentSlug: null },
  { slug: 'income.salary', name: 'Salary', parentSlug: 'income' },
  { slug: 'income.freelance', name: 'Freelance', parentSlug: 'income' },
  { slug: 'income.investment', name: 'Investment Income', parentSlug: 'income' },
  { slug: 'income.other', name: 'Other', parentSlug: 'income' },

  { slug: 'uncategorized', name: 'Uncategorized', parentSlug: null },
];

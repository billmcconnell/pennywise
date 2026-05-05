import { z } from 'zod';

/**
 * Canonical domain schemas. Mirror Appendix A of the PRD, narrowed by
 * locked decisions: tags yes / splits no for v1, household_id above user_id,
 * currency_code paired with every amount, soft-delete via archived_at.
 */

export const accountTypeSchema = z.enum(['checking', 'savings', 'credit_card', 'investment']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const moneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'must be a decimal string with at most 2 fractional digits');

export const currencyCodeSchema = z.string().length(3).default('USD');

export const householdIdSchema = z.string().uuid();
export const userIdSchema = z.string().uuid();
export const accountIdSchema = z.string().uuid();
export const categoryIdSchema = z.string().uuid();
export const transactionIdSchema = z.string().uuid();

export const accountSchema = z.object({
  id: accountIdSchema,
  householdId: householdIdSchema,
  name: z.string().min(1),
  type: accountTypeSchema,
  institution: z.string().nullable(),
  lastFour: z.string().regex(/^\d{4}$/).nullable(),
  openingBalance: moneySchema,
  currencyCode: currencyCodeSchema,
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountCreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: accountTypeSchema,
  institution: z.string().max(120).nullable().optional(),
  lastFour: z.string().regex(/^\d{4}$/).nullable().optional(),
  openingBalance: moneySchema.optional(),
  currencyCode: z.string().length(3).optional(),
});
export type AccountCreate = z.infer<typeof accountCreateSchema>;

export const accountUpdateSchema = accountCreateSchema.partial();
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;

export const accountWithBalanceSchema = accountSchema.extend({
  currentBalance: moneySchema,
});
export type AccountWithBalance = z.infer<typeof accountWithBalanceSchema>;

export const categorySchema = z.object({
  id: categoryIdSchema,
  householdId: householdIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  parentId: categoryIdSchema.nullable(),
  isSystem: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Category = z.infer<typeof categorySchema>;

export const transactionSchema = z.object({
  id: transactionIdSchema,
  householdId: householdIdSchema,
  accountId: accountIdSchema,
  transactionDate: z.string().date(),
  postDate: z.string().date().nullable(),
  amount: moneySchema,
  currencyCode: currencyCodeSchema,
  description: z.string(),
  originalDescription: z.string(),
  merchant: z.string().nullable(),
  categoryId: categoryIdSchema.nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  bankTransactionId: z.string().nullable(),
  fingerprint: z.string(),
  autoCategorized: z.boolean(),
  confidenceScore: z.number().min(0).max(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const householdSchema = z.object({
  id: householdIdSchema,
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof householdSchema>;

import { z } from 'zod';

/**
 * Canonical domain schemas. Mirror Appendix A of the PRD, narrowed by
 * locked decisions: tags yes / splits yes, household_id above user_id,
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

export const transactionUpdateSchema = z
  .object({
    description: z.string().min(1).max(500).optional(),
    merchant: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().min(1).max(60)).max(50).optional(),
    categoryId: categoryIdSchema.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

export const transactionSplitSchema = z.object({
  id: z.string().uuid(),
  transactionId: transactionIdSchema,
  amount: moneySchema,
  categoryId: categoryIdSchema.nullable(),
  categoryName: z.string().nullable(),
  categorySlug: z.string().nullable(),
  notes: z.string().nullable(),
});
export type TransactionSplit = z.infer<typeof transactionSplitSchema>;

export const splitUpsertSchema = z.object({
  splits: z
    .array(
      z.object({
        amount: moneySchema,
        categoryId: categoryIdSchema.nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .max(50),
});
export type SplitUpsert = z.infer<typeof splitUpsertSchema>;

export const ruleMatchTypeSchema = z.enum([
  'merchant_contains',
  'merchant_equals',
  'description_contains',
  'description_regex',
]);
export type RuleMatchType = z.infer<typeof ruleMatchTypeSchema>;

export const ruleIdSchema = z.string().uuid();

export const categorizationRuleSchema = z.object({
  id: ruleIdSchema,
  householdId: householdIdSchema,
  matchType: ruleMatchTypeSchema,
  pattern: z.string().min(1).max(500),
  caseInsensitive: z.boolean(),
  categoryId: categoryIdSchema,
  priority: z.number().int(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CategorizationRule = z.infer<typeof categorizationRuleSchema>;

export const ruleCreateSchema = z.object({
  matchType: ruleMatchTypeSchema,
  pattern: z.string().min(1).max(500),
  caseInsensitive: z.boolean().optional(),
  categoryId: categoryIdSchema,
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
});
export type RuleCreate = z.infer<typeof ruleCreateSchema>;

export const ruleUpdateSchema = ruleCreateSchema.partial();
export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;

export const ruleApplyScopeSchema = z.enum(['uncategorized', 'auto_categorized', 'all_unedited']);
export type RuleApplyScope = z.infer<typeof ruleApplyScopeSchema>;

export const ruleApplyBodySchema = z.object({
  scope: ruleApplyScopeSchema,
  accountId: accountIdSchema.optional(),
});
export type RuleApplyBody = z.infer<typeof ruleApplyBodySchema>;

export const householdSchema = z.object({
  id: householdIdSchema,
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof householdSchema>;

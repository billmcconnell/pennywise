import Anthropic from '@anthropic-ai/sdk';
import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import type { AppConfig } from '../config.js';
import { accounts, categories, categorizationRules, transactionEdits, transactions } from '../db/schema.js';
import { parseAmexCsv } from '../ingest/amex-parser.js';
import { parseOfx, isOfxContent } from '../ingest/ofx-parser.js';
import { parseUsaaCsv, isUsaaContent } from '../ingest/usaa-parser.js';
import { parseSofiCsv, isSofiContent } from '../ingest/sofi-parser.js';
import { parseBaskCsv, isBaskContent } from '../ingest/bask-parser.js';
import { applyRules, sortRules, type RuleLike } from '../ingest/rules-engine.js';
import {
  categorizeBatch,
  LLM_APPLY_THRESHOLD,
  LLM_RULE_THRESHOLD,
  type FeedbackExample,
} from '../ingest/llm-categorizer.js';

export interface ImportResult {
  parsed: number;
  inserted: number;
  skipped: number;
  autoCategorized: number;
  errors: { rowIndex: number; message: string }[];
}

export const importRoutes: (db: Db, config: AppConfig) => FastifyPluginAsync =
  (db, config) => async (app) => {
    app.post('/imports', async (req, reply) => {
      const household = req.household;
      if (!household) return reply.code(401).send({ error: 'no household' });

      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'file field required' });

      const accountIdField = file.fields['accountId'];
      const accountIdValue =
        accountIdField && 'value' in accountIdField ? String(accountIdField.value) : null;
      if (!accountIdValue) return reply.code(400).send({ error: 'accountId field required' });

      const account = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, accountIdValue), eq(accounts.householdId, household.id)))
        .limit(1);
      if (account.length === 0) return reply.code(404).send({ error: 'account not found' });

      const buf = await file.toBuffer();
      const filename = (file.filename ?? '').toLowerCase();
      const isOfx = isOfxContent(buf) || filename.endsWith('.ofx') || filename.endsWith('.qfx');

      let parseOut;
      try {
        if (isOfx) {
          parseOut = parseOfx(buf.toString('utf8'));
        } else if (isUsaaContent(buf)) {
          parseOut = parseUsaaCsv(buf.toString('utf8'));
        } else if (isSofiContent(buf)) {
          parseOut = parseSofiCsv(buf.toString('utf8'));
        } else if (isBaskContent(buf)) {
          parseOut = parseBaskCsv(buf.toString('utf8'));
        } else {
          parseOut = parseAmexCsv(buf.toString('utf8'));
        }
      } catch (err) {
        return reply
          .code(400)
          .send({ error: 'parse failed', detail: err instanceof Error ? err.message : String(err) });
      }

      const uncat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.householdId, household.id), eq(categories.slug, 'uncategorized')))
        .limit(1);
      const uncategorizedId = uncat[0]?.id ?? null;

      const ruleRows = await db
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
      const sortedRules = sortRules(ruleRows as RuleLike[]);

      // Phase 1: apply rules to every row, collect pending inserts
      type PendingInsert = {
        row: (typeof parseOut.rows)[number];
        categoryId: string | null;
        autoCategorized: boolean;
        confidenceScore: number | null;
        ruleMatched: boolean;
      };

      const pending: PendingInsert[] = parseOut.rows.map((row) => {
        const match = applyRules(
          { description: row.description, originalDescription: row.originalDescription, merchant: null },
          sortedRules,
        );
        return {
          row,
          categoryId: match ? match.categoryId : uncategorizedId,
          autoCategorized: match !== null,
          confidenceScore: match !== null ? 1 : null,
          ruleMatched: match !== null,
        };
      });

      // Phase 2: LLM pass on unmatched transactions (if API key configured)
      if (config.ANTHROPIC_API_KEY) {
        const unmatchedIndexed = pending
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => !p.ruleMatched);

        if (unmatchedIndexed.length > 0) {
          try {
            const topCats = await db
              .select({ id: categories.id, slug: categories.slug, name: categories.name })
              .from(categories)
              .where(
                and(
                  eq(categories.householdId, household.id),
                  isNull(categories.parentId),
                  isNull(categories.archivedAt),
                ),
              );

            // Load recent category corrections as few-shot examples
            const correctionRows = await db
              .select({
                pattern: sql<string>`coalesce(nullif(${transactions.merchant}, ''), ${transactions.description})`,
                categorySlug: categories.slug,
                categoryName: categories.name,
              })
              .from(transactionEdits)
              .innerJoin(transactions, eq(transactionEdits.transactionId, transactions.id))
              .innerJoin(categories, eq(transactions.categoryId, categories.id))
              .where(
                and(
                  eq(transactionEdits.householdId, household.id),
                  eq(transactionEdits.field, 'category'),
                  isNull(categories.parentId),
                  isNull(categories.archivedAt),
                ),
              )
              .orderBy(desc(transactionEdits.editedAt))
              .limit(200);

            const seen = new Set<string>();
            const feedbackExamples: FeedbackExample[] = [];
            for (const r of correctionRows) {
              const key = `${r.pattern}\0${r.categorySlug}`;
              if (!seen.has(key)) {
                seen.add(key);
                feedbackExamples.push(r);
                if (feedbackExamples.length >= 30) break;
              }
            }

            const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
            const llmResults = await categorizeBatch(
              client,
              unmatchedIndexed.map(({ p }, llmIdx) => ({
                index: llmIdx,
                description: p.row.description,
                originalDescription: p.row.originalDescription,
                amount: p.row.amount,
              })),
              topCats,
              feedbackExamples.length > 0 ? feedbackExamples : undefined,
            );

            const catBySlug = new Map(topCats.map((c) => [c.slug, c]));
            const existingPatterns = new Set(
              sortedRules.map((r) => r.pattern.toLowerCase()),
            );

            for (const res of llmResults) {
              if (res.confidence < LLM_APPLY_THRESHOLD) continue;
              const cat = catBySlug.get(res.categorySlug);
              if (!cat) continue;

              const target = unmatchedIndexed[res.index];
              if (!target) continue;
              const item = pending[target.i]!;
              item.categoryId = cat.id;
              item.autoCategorized = true;
              item.confidenceScore = res.confidence;

              // Promote high-confidence results to a rule so future imports don't need LLM
              if (
                res.confidence >= LLM_RULE_THRESHOLD &&
                res.matchTerm &&
                !existingPatterns.has(res.matchTerm.toLowerCase())
              ) {
                existingPatterns.add(res.matchTerm.toLowerCase());
                await db.insert(categorizationRules).values({
                  householdId: household.id,
                  matchType: 'description_contains',
                  pattern: res.matchTerm,
                  caseInsensitive: true,
                  categoryId: cat.id,
                  priority: 0,
                  enabled: true,
                });
              }
            }
          } catch (err) {
            req.log.warn({ err }, 'LLM categorization failed — proceeding without it');
          }
        }
      }

      // Phase 3: insert all rows
      let inserted = 0;
      let skipped = 0;
      let autoCategorized = 0;

      for (const item of pending) {
        const result = await db
          .insert(transactions)
          .values({
            householdId: household.id,
            accountId: accountIdValue,
            transactionDate: item.row.transactionDate,
            amount: item.row.amount,
            description: item.row.description,
            originalDescription: item.row.originalDescription,
            bankTransactionId: item.row.bankTransactionId,
            fingerprint: item.row.fingerprint,
            categoryId: item.categoryId,
            autoCategorized: item.autoCategorized,
            confidenceScore: item.confidenceScore,
          })
          .onConflictDoNothing({
            target: [transactions.accountId, transactions.fingerprint],
          })
          .returning({ id: transactions.id });

        if (result.length > 0) {
          inserted += 1;
          if (item.autoCategorized) autoCategorized += 1;
        } else {
          skipped += 1;
        }
      }

      return {
        parsed: parseOut.rows.length,
        inserted,
        skipped,
        autoCategorized,
        errors: parseOut.errors.map((e) => ({ rowIndex: e.rowIndex, message: e.message })),
      } satisfies ImportResult;
    });
  };

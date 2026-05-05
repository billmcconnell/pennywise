import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts, categories, transactions } from '../db/schema.js';
import { parseAmexCsv } from '../ingest/amex-parser.js';

export interface ImportResult {
  parsed: number;
  inserted: number;
  skipped: number;
  errors: { rowIndex: number; message: string }[];
}

export const importRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
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
    const csvText = buf.toString('utf8');

    let parseOut;
    try {
      parseOut = parseAmexCsv(csvText);
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

    let inserted = 0;
    let skipped = 0;
    for (const row of parseOut.rows) {
      const result = await db
        .insert(transactions)
        .values({
          householdId: household.id,
          accountId: accountIdValue,
          transactionDate: row.transactionDate,
          amount: row.amount,
          description: row.description,
          originalDescription: row.originalDescription,
          bankTransactionId: row.bankTransactionId,
          fingerprint: row.fingerprint,
          categoryId: uncategorizedId,
          autoCategorized: false,
        })
        .onConflictDoNothing({
          target: [transactions.accountId, transactions.fingerprint],
        })
        .returning({ id: transactions.id });
      if (result.length > 0) inserted += 1;
      else skipped += 1;
    }

    const result: ImportResult = {
      parsed: parseOut.rows.length,
      inserted,
      skipped,
      errors: parseOut.errors.map((e) => ({ rowIndex: e.rowIndex, message: e.message })),
    };
    return result;
  });
};

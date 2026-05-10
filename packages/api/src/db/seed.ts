import { eq } from 'drizzle-orm';
import { loadConfig } from '../config.js';
import { makeDb } from './client.js';
import { accounts, categories, households } from './schema.js';
import { seedHousehold } from './seedHousehold.js';

const DEV_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001';
const DEV_HOUSEHOLD_NAME = 'Dev Household';
const DEV_ACCOUNT_ID = '00000000-0000-0000-0000-000000000010';
const DEV_ACCOUNT_NAME = 'Amex (dev)';

async function seed(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = makeDb(config.DATABASE_URL);

  try {
    await db
      .insert(households)
      .values({ id: DEV_HOUSEHOLD_ID, name: DEV_HOUSEHOLD_NAME })
      .onConflictDoNothing({ target: households.id });

    await seedHousehold(db, DEV_HOUSEHOLD_ID);

    await db
      .insert(accounts)
      .values({
        id: DEV_ACCOUNT_ID,
        householdId: DEV_HOUSEHOLD_ID,
        name: DEV_ACCOUNT_NAME,
        type: 'credit_card',
        institution: 'American Express',
      })
      .onConflictDoNothing({ target: accounts.id });

    const total = await db
      .select()
      .from(categories)
      .where(eq(categories.householdId, DEV_HOUSEHOLD_ID));
    console.log(
      `seed ok: household=${DEV_HOUSEHOLD_ID} account=${DEV_ACCOUNT_ID} categories=${total.length}`,
    );
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});

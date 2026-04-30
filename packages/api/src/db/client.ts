import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export type Db = ReturnType<typeof drizzle>;

export function makeDb(databaseUrl: string): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  return { db, pool };
}

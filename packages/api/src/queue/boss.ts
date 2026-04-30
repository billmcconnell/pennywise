import PgBoss from 'pg-boss';

export type Queue = PgBoss;

export async function makeQueue(databaseUrl: string): Promise<Queue> {
  const boss = new PgBoss({ connectionString: databaseUrl });
  await boss.start();
  return boss;
}

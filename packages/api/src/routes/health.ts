import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/client.js';
import { sql } from 'drizzle-orm';

export const healthRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/healthz', async () => ({ ok: true, ts: new Date().toISOString() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { ok: true, db: 'up' };
    } catch (err) {
      app.log.error({ err }, 'readyz: db down');
      return reply.code(503).send({ ok: false, db: 'down' });
    }
  });
};

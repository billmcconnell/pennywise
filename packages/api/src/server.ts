import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { loadConfig } from './config.js';
import { makeDb } from './db/client.js';
import { makeQueue } from './queue/boss.js';
import { devAuthPlugin } from './auth/dev-resolver.js';
import { healthRoutes } from './routes/health.js';
import { importRoutes } from './routes/imports.js';
import { categoryRoutes } from './routes/categories.js';
import { transactionRoutes } from './routes/transactions.js';
import { accountRoutes } from './routes/accounts.js';
import { ruleRoutes } from './routes/rules.js';
import { exportRoutes } from './routes/exports.js';
import { budgetRoutes } from './routes/budgets.js';
import { billRoutes } from './routes/bills.js';
import { goalRoutes } from './routes/goals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const config = loadConfig();
  const loggerOptions =
    config.NODE_ENV === 'production'
      ? { level: 'info' }
      : {
          level: 'debug',
          transport: { target: 'pino-pretty', options: { colorize: true } },
        };
  const app = Fastify({ logger: loggerOptions });

  await app.register(sensible);

  const { db, pool } = makeDb(config.DATABASE_URL);
  const queue = await makeQueue(config.DATABASE_URL);

  await app.register(fastifyMultipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  await app.register(devAuthPlugin);
  await app.register(healthRoutes(db), { prefix: '/api' });
  await app.register(importRoutes(db), { prefix: '/api' });
  await app.register(categoryRoutes(db), { prefix: '/api' });
  await app.register(transactionRoutes(db), { prefix: '/api' });
  await app.register(accountRoutes(db), { prefix: '/api' });
  await app.register(ruleRoutes(db), { prefix: '/api' });
  await app.register(exportRoutes(db), { prefix: '/api' });
  await app.register(budgetRoutes(db), { prefix: '/api' });
  await app.register(billRoutes(db), { prefix: '/api' });
  await app.register(goalRoutes(db), { prefix: '/api' });

  const webDist = path.resolve(__dirname, '..', config.WEB_DIST);
  await app.register(fastifyStatic, {
    root: webDist,
    prefix: '/',
    wildcard: false,
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await queue.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

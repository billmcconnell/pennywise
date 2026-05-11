import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import './types.js';

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('household', null);
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    req.household = { id: '00000000-0000-0000-0000-000000000001', name: 'Dev Household' };
    req.user = { id: '00000000-0000-0000-0000-000000000020', email: 'dev@pennywise.local' };
  });

  app.get('/api/auth/me', async (req) => {
    return { user: req.user, household: req.household };
  });
};

export const devAuthPlugin = fp(plugin, { name: 'dev-auth' });

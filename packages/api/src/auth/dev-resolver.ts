import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('household', null);
  app.addHook('onRequest', async (req) => {
    req.household = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Dev Household',
    };
  });
};

export const devAuthPlugin = fp(plugin, { name: 'dev-auth' });

declare module 'fastify' {
  interface FastifyRequest {
    household: { id: string; name: string } | null;
  }
}

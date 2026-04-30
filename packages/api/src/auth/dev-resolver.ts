import type { FastifyPluginAsync } from 'fastify';

/**
 * Phase 0 dev auth: every request is treated as the seeded household.
 * Real Auth.js magic-link wires in Phase 1.
 */
export const devAuthPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('household', null);
  app.addHook('onRequest', async (req) => {
    req.household = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Dev Household',
    };
  });
};

declare module 'fastify' {
  interface FastifyRequest {
    household: { id: string; name: string } | null;
  }
}

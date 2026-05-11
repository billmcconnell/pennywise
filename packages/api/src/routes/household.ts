import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { householdInvites, users } from '../db/schema.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const householdRoutes: (db: Db) => FastifyPluginAsync = (db) => async (app) => {
  app.get('/household/members', async (req, reply) => {
    if (!req.household) return reply.code(401).send({ error: 'unauthenticated' });
    return db
      .select({ id: users.id, email: users.email, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.householdId, req.household.id));
  });

  app.delete<{ Params: { userId: string } }>('/household/members/:userId', async (req, reply) => {
    if (!req.household || !req.user) return reply.code(401).send({ error: 'unauthenticated' });
    const { userId } = req.params;
    if (userId === req.user.id) return reply.code(400).send({ error: 'cannot remove yourself' });

    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.householdId, req.household.id)))
      .limit(1);
    if (!target) return reply.code(404).send({ error: 'member not found' });

    await db.delete(users).where(eq(users.id, userId));
    return reply.code(204).send();
  });

  app.get('/household/invites', async (req, reply) => {
    if (!req.household) return reply.code(401).send({ error: 'unauthenticated' });
    const now = new Date();
    return db
      .select({
        id: householdInvites.id,
        invitedEmail: householdInvites.invitedEmail,
        expiresAt: householdInvites.expiresAt,
        createdAt: householdInvites.createdAt,
      })
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.householdId, req.household.id),
          isNull(householdInvites.usedAt),
          gt(householdInvites.expiresAt, now),
        ),
      );
  });

  app.post<{ Body: { email: string } }>('/household/invite', async (req, reply) => {
    if (!req.household) return reply.code(401).send({ error: 'unauthenticated' });

    const email = (req.body as { email: string }).email?.toLowerCase().trim();
    if (!email) return reply.code(400).send({ error: 'email required' });

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return reply.code(409).send({ error: 'This email already has a Pennywise account' });
    }

    const now = new Date();
    const [pending] = await db
      .select({ id: householdInvites.id })
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.householdId, req.household.id),
          eq(householdInvites.invitedEmail, email),
          isNull(householdInvites.usedAt),
          gt(householdInvites.expiresAt, now),
        ),
      )
      .limit(1);
    if (pending) {
      return reply.code(409).send({ error: 'A pending invite already exists for this email' });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(householdInvites).values({
      householdId: req.household.id,
      invitedEmail: email,
      tokenHash,
      expiresAt,
      createdBy: req.user?.id ?? null,
    });

    return { token, email, expiresAt };
  });

  app.delete<{ Params: { inviteId: string } }>(
    '/household/invites/:inviteId',
    async (req, reply) => {
      if (!req.household) return reply.code(401).send({ error: 'unauthenticated' });
      await db
        .delete(householdInvites)
        .where(
          and(
            eq(householdInvites.id, req.params.inviteId),
            eq(householdInvites.householdId, req.household.id),
          ),
        );
      return reply.code(204).send();
    },
  );
};

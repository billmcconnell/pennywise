import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import cookie from '@fastify/cookie';
import nodemailer from 'nodemailer';
import { and, eq, gt } from 'drizzle-orm';
import { householdInvites, households, magicTokens, sessions, users } from '../db/schema.js';
import type { AppConfig } from '../config.js';
import type { Db } from '../db/client.js';
import { seedHousehold } from '../db/seedHousehold.js';
import './types.js';

const COOKIE_NAME = 'pennywise_session';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function magicLinkPlugin(db: Db, config: AppConfig) {
  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(cookie);

    app.decorateRequest('household', null);
    app.decorateRequest('user', null);

    app.addHook('onRequest', async (req) => {
      const token = req.cookies[COOKIE_NAME];
      if (!token) return;

      const tokenHash = hashToken(token);
      const now = new Date();

      const rows = await db
        .select({
          userId: sessions.userId,
          userEmail: users.email,
          householdId: users.householdId,
          householdName: households.name,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .innerJoin(households, eq(households.id, users.householdId))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);

      const row = rows[0];
      if (!row) return;

      req.household = { id: row.householdId, name: row.householdName };
      req.user = { id: row.userId, email: row.userEmail };
    });

    app.get('/api/auth/me', async (req, reply) => {
      if (!req.household || !req.user) return reply.code(401).send({ error: 'unauthenticated' });
      return { user: req.user, household: req.household };
    });

    app.post<{ Body: { email: string } }>('/api/auth/send', async (req, reply) => {
      const email = (req.body as { email: string }).email?.toLowerCase().trim();
      if (!email) return reply.code(400).send({ error: 'email required' });

      if (config.ALLOWED_EMAILS.length > 0 && !config.ALLOWED_EMAILS.includes(email)) {
        return { ok: true };
      }

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(magicTokens).values({ email, tokenHash, expiresAt });

      const verifyUrl = `${config.APP_URL}/api/auth/verify?token=${token}`;

      if (config.SMTP_HOST) {
        const port = config.SMTP_PORT ?? 587;
        const transporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port,
          secure: port === 465,
          auth:
            config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        });
        await transporter.sendMail({
          from: config.SMTP_FROM,
          to: email,
          subject: 'Sign in to Pennywise',
          text: `Click to sign in:\n${verifyUrl}\n\nThis link expires in 15 minutes.`,
          html: `<p>Click to sign in:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 15 minutes.</p>`,
        });
        return { ok: true };
      }

      req.log.info({ verifyUrl }, 'magic link (SMTP not configured — use devUrl)');
      return { ok: true, devUrl: verifyUrl };
    });

    app.get<{ Querystring: { token?: string } }>('/api/auth/verify', async (req, reply) => {
      const { token } = req.query;
      if (!token) return reply.code(400).send({ error: 'missing token' });

      const tokenHash = hashToken(token);
      const now = new Date();

      const rows = await db
        .select()
        .from(magicTokens)
        .where(and(eq(magicTokens.tokenHash, tokenHash), gt(magicTokens.expiresAt, now)))
        .limit(1);

      const magicToken = rows[0];
      if (!magicToken || magicToken.usedAt) {
        return reply.code(400).send({ error: 'invalid or expired link' });
      }

      await db
        .update(magicTokens)
        .set({ usedAt: now })
        .where(eq(magicTokens.id, magicToken.id));

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.email, magicToken.email))
        .limit(1);

      let user: typeof userRows[0] | undefined = userRows[0];
      if (!user) {
        const name = magicToken.email.split('@')[0];
        const newHouseholds = await db
          .insert(households)
          .values({ name: `${name}'s household` })
          .returning();
        const household = newHouseholds[0];
        if (!household) throw new Error('failed to create household');
        await seedHousehold(db, household.id);
        const newUsers = await db
          .insert(users)
          .values({ email: magicToken.email, householdId: household.id })
          .returning();
        user = newUsers[0];
        if (!user) throw new Error('failed to create user');
      }

      const sessionToken = generateToken();
      const sessionHash = hashToken(sessionToken);
      const sessionExpiry = new Date(
        Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      if (!user) throw new Error('user not found after login');

      await db.insert(sessions).values({
        userId: user.id,
        tokenHash: sessionHash,
        expiresAt: sessionExpiry,
      });

      const isProd = config.NODE_ENV === 'production';
      reply.setCookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: config.SESSION_TTL_DAYS * 24 * 60 * 60,
        path: '/',
      });

      return reply.redirect('/');
    });

    app.post('/api/auth/logout', async (req, reply) => {
      const token = req.cookies[COOKIE_NAME];
      if (token) {
        await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
      }
      reply.clearCookie(COOKIE_NAME, { path: '/' });
      return { ok: true };
    });

    app.get<{ Querystring: { token?: string } }>('/api/auth/accept-invite', async (req, reply) => {
      const { token } = req.query;
      if (!token) return reply.code(400).send({ error: 'missing token' });

      const tokenHash = hashToken(token);
      const now = new Date();

      const [invite] = await db
        .select()
        .from(householdInvites)
        .where(and(eq(householdInvites.tokenHash, tokenHash), gt(householdInvites.expiresAt, now)))
        .limit(1);

      if (!invite || invite.usedAt) {
        return reply.code(400).send({ error: 'invalid or expired invite link' });
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, invite.invitedEmail))
        .limit(1);

      if (existingUser && existingUser.householdId !== invite.householdId) {
        return reply.code(409).send({ error: 'This email already has a Pennywise account' });
      }

      await db
        .update(householdInvites)
        .set({ usedAt: now })
        .where(eq(householdInvites.id, invite.id));

      let userId: string;
      if (existingUser) {
        userId = existingUser.id;
      } else {
        const [newUser] = await db
          .insert(users)
          .values({ email: invite.invitedEmail, householdId: invite.householdId })
          .returning();
        if (!newUser) throw new Error('failed to create user');
        userId = newUser.id;
      }

      const sessionToken = generateToken();
      const sessionHash = hashToken(sessionToken);
      const sessionExpiry = new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

      await db.insert(sessions).values({ userId, tokenHash: sessionHash, expiresAt: sessionExpiry });

      const isProd = config.NODE_ENV === 'production';
      reply.setCookie(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: config.SESSION_TTL_DAYS * 24 * 60 * 60,
        path: '/',
      });

      return reply.redirect('/');
    });
  };

  return fp(plugin, { name: 'magic-link-auth' });
}

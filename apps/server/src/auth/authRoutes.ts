import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { emailRegisterSchema, emailLoginSchema, guestUpgradeSchema, refreshTokenSchema } from '@velocity-island/shared';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from './tokens.js';
import { createDefaultProfileFor } from '../services/ProfileService.js';
import { requireAuth } from './requireAuth.js';

async function issueTokenPair(userId: string, displayName: string) {
  const accessToken = signAccessToken({ sub: userId, displayName });
  const refreshToken = generateRefreshToken();
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: hashRefreshToken(refreshToken) } });
  return { accessToken, refreshToken };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/guest', async (_request, reply) => {
    const displayName = `GUEST_${randomUUID().slice(0, 8).toUpperCase()}`;
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { authProvider: 'GUEST' } });
      await createDefaultProfileFor(tx, created.id, displayName);
      return created;
    });
    const tokens = await issueTokenPair(user.id, displayName);
    return reply.code(201).send({ userId: user.id, displayName, isGuest: true, ...tokens });
  });

  app.post('/auth/register', async (request, reply) => {
    const parsed = emailRegisterSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    const { email, password, displayName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: 'email_taken' });
    const nameTaken = await prisma.profile.findUnique({ where: { displayName } });
    if (nameTaken) return reply.code(409).send({ error: 'display_name_taken' });

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, passwordHash, authProvider: 'EMAIL' } });
      await createDefaultProfileFor(tx, created.id, displayName);
      return created;
    });
    const tokens = await issueTokenPair(user.id, displayName);
    return reply.code(201).send({ userId: user.id, displayName, isGuest: false, ...tokens });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = emailLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user?.passwordHash || !user.profile) return reply.code(401).send({ error: 'invalid_credentials' });
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return reply.code(401).send({ error: 'invalid_credentials' });

    const tokens = await issueTokenPair(user.id, user.profile.displayName);
    return reply.send({ userId: user.id, displayName: user.profile.displayName, isGuest: false, ...tokens });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshTokenSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const incomingHash = hashRefreshToken(parsed.data.refreshToken);
    const user = await prisma.user.findFirst({ where: { refreshTokenHash: incomingHash }, include: { profile: true } });
    if (!user?.profile) return reply.code(401).send({ error: 'invalid_refresh_token' });

    const tokens = await issueTokenPair(user.id, user.profile.displayName);
    return reply.send(tokens);
  });

  app.post('/auth/upgrade', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = guestUpgradeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const userId = request.userId!;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    if (user.authProvider === 'EMAIL') return reply.code(409).send({ error: 'already_upgraded' });

    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) return reply.code(409).send({ error: 'email_taken' });

    const passwordHash = await hashPassword(parsed.data.password);
    // Same user id/profile row throughout — progress (coins, XP, unlocks) is never touched.
    await prisma.user.update({
      where: { id: userId },
      data: { email: parsed.data.email, passwordHash, authProvider: 'EMAIL' },
    });
    await prisma.profile.update({ where: { userId }, data: { displayName: parsed.data.displayName } });

    return reply.send({ ok: true });
  });
}

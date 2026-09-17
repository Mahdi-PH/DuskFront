import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/requireAuth.js';

const displayNameSchema = z.object({ displayName: z.string().min(1).max(20) });
const friendshipIdSchema = z.object({ friendshipId: z.string().uuid() });

export async function registerFriendsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/friends/search', { preHandler: requireAuth }, async (request, reply) => {
    const query = (request.query as { q?: string }).q ?? '';
    if (query.length < 2) return reply.send([]);
    const profiles = await prisma.profile.findMany({
      where: { displayName: { contains: query, mode: 'insensitive' }, userId: { not: request.userId! } },
      take: 20,
      select: { userId: true, displayName: true, level: true },
    });
    return reply.send(profiles);
  });

  app.get('/friends', { preHandler: requireAuth }, async (request, reply) => {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: request.userId! }, { userBId: request.userId! }] },
    });
    const otherIds = friendships.map((f) => (f.userAId === request.userId! ? f.userBId : f.userAId));
    const profiles = await prisma.profile.findMany({ where: { userId: { in: otherIds } } });
    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

    return reply.send(
      friendships.map((f) => ({
        friendshipId: f.id,
        status: f.status,
        isIncoming: f.userBId === request.userId!,
        profile: profileByUserId.get(f.userAId === request.userId! ? f.userBId : f.userAId) ?? null,
      })),
    );
  });

  app.post('/friends/request', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = displayNameSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const target = await prisma.profile.findUnique({ where: { displayName: parsed.data.displayName } });
    if (!target || target.userId === request.userId!) return reply.code(404).send({ error: 'not_found' });

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: request.userId!, userBId: target.userId },
          { userAId: target.userId, userBId: request.userId! },
        ],
      },
    });
    if (existing) return reply.code(409).send({ error: 'already_requested' });

    const friendship = await prisma.friendship.create({
      data: { userAId: request.userId!, userBId: target.userId, status: 'pending' },
    });
    return reply.code(201).send(friendship);
  });

  app.post('/friends/accept', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = friendshipIdSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const friendship = await prisma.friendship.findUnique({ where: { id: parsed.data.friendshipId } });
    if (!friendship || friendship.userBId !== request.userId!) return reply.code(404).send({ error: 'not_found' });

    const updated = await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'accepted' } });
    return reply.send(updated);
  });

  app.delete('/friends/:friendshipId', { preHandler: requireAuth }, async (request, reply) => {
    const { friendshipId } = request.params as { friendshipId: string };
    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || (friendship.userAId !== request.userId! && friendship.userBId !== request.userId!)) {
      return reply.code(404).send({ error: 'not_found' });
    }
    await prisma.friendship.delete({ where: { id: friendshipId } });
    return reply.send({ ok: true });
  });
}

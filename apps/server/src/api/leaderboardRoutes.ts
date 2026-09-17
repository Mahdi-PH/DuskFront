import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/requireAuth.js';

const LIMIT = 50;

export async function registerLeaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/leaderboard/global', async (_request, reply) => {
    const profiles = await prisma.profile.findMany({
      orderBy: { totalXp: 'desc' },
      take: LIMIT,
      select: { displayName: true, totalXp: true, level: true },
    });
    return reply.send(profiles);
  });

  app.get('/leaderboard/weekly', async (_request, reply) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const entries = await prisma.matchHistoryEntry.findMany({
      where: { playedAt: { gte: since } },
      include: { user: { include: { profile: true } } },
    });

    const scoreByUser = new Map<string, { displayName: string; score: number }>();
    for (const entry of entries) {
      const displayName = entry.user.profile?.displayName ?? 'RACER';
      const points = Math.max(0, 9 - entry.position);
      const current = scoreByUser.get(entry.userId) ?? { displayName, score: 0 };
      current.score += points;
      scoreByUser.set(entry.userId, current);
    }

    const ranked = Array.from(scoreByUser.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMIT);
    return reply.send(ranked);
  });

  app.get('/leaderboard/track/:trackId', async (request, reply) => {
    const { trackId } = request.params as { trackId: string };
    const records = await prisma.leaderboard.findMany({
      where: { scope: 'track', trackId },
      orderBy: { value: 'asc' },
      take: LIMIT,
      select: { displayName: true, value: true, recordedAt: true },
    });
    return reply.send(records);
  });

  app.get('/leaderboard/friends', { preHandler: requireAuth }, async (request, reply) => {
    const friendships = await prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ userAId: request.userId! }, { userBId: request.userId! }] },
    });
    const friendIds = friendships.map((f) => (f.userAId === request.userId! ? f.userBId : f.userAId));
    friendIds.push(request.userId!);

    const profiles = await prisma.profile.findMany({
      where: { userId: { in: friendIds } },
      orderBy: { totalXp: 'desc' },
      select: { displayName: true, totalXp: true, level: true },
    });
    return reply.send(profiles);
  });
}

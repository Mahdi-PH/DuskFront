import type { FastifyInstance } from 'fastify';
import { ACHIEVEMENTS } from '@velocity-island/shared';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/requireAuth.js';

export async function registerAchievementsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/achievements', { preHandler: requireAuth }, async (request, reply) => {
    const rows = await prisma.playerAchievement.findMany({ where: { userId: request.userId! } });
    const rowById = new Map(rows.map((r) => [r.achievementId, r]));

    return reply.send(
      ACHIEVEMENTS.map((def) => ({
        ...def,
        progress: rowById.get(def.id)?.progress ?? 0,
        unlockedAt: rowById.get(def.id)?.unlockedAt ?? null,
      })),
    );
  });
}

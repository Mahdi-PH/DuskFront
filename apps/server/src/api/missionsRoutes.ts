import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ECONOMY_BALANCE } from '@velocity-island/shared';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/requireAuth.js';
import { creditCurrency } from '../services/CurrencyService.js';
import { awardXp } from '../services/ProgressionService.js';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickTodaysMissionDefs(userId: string) {
  let seed = 0;
  for (const ch of userId + todayKey()) seed += ch.charCodeAt(0);
  const pool = ECONOMY_BALANCE.dailyMissions.pool;
  return Array.from({ length: ECONOMY_BALANCE.dailyMissions.countPerDay }, (_, i) => pool[(seed + i * 7) % pool.length]!);
}

const progressSchema = z.object({ missionId: z.string().min(1), amount: z.number().positive() });

export async function registerMissionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/missions/today', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.userId!;
    const defs = pickTodaysMissionDefs(userId);
    const assignedDate = todayKey();

    const rows = await Promise.all(
      defs.map((def) =>
        prisma.playerMission.upsert({
          where: { userId_missionId_assignedDate: { userId, missionId: def.id, assignedDate } },
          update: {},
          create: { userId, missionId: def.id, assignedDate, progress: 0 },
        }),
      ),
    );

    return reply.send(
      defs.map((def, i) => ({
        ...def,
        progress: rows[i]!.progress,
        completed: rows[i]!.completedAt !== null,
      })),
    );
  });

  app.post('/missions/progress', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = progressSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const userId = request.userId!;
    const assignedDate = todayKey();

    const def = ECONOMY_BALANCE.dailyMissions.pool.find((m) => m.id === parsed.data.missionId);
    if (!def) return reply.code(404).send({ error: 'unknown_mission' });
    const todaysDefs = pickTodaysMissionDefs(userId);
    if (!todaysDefs.some((d) => d.id === def.id)) return reply.code(403).send({ error: 'mission_not_assigned_today' });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.playerMission.upsert({
        where: { userId_missionId_assignedDate: { userId, missionId: def.id, assignedDate } },
        update: {},
        create: { userId, missionId: def.id, assignedDate, progress: 0 },
      });
      if (existing.completedAt) return { alreadyCompleted: true, progress: existing.progress };

      const newProgress = existing.progress + parsed.data.amount;
      const justCompleted = newProgress >= def.target;
      const updated = await tx.playerMission.update({
        where: { id: existing.id },
        data: { progress: newProgress, completedAt: justCompleted ? new Date() : null },
      });

      if (justCompleted) {
        const idempotencyKey = `mission:${userId}:${def.id}:${assignedDate}`;
        await creditCurrency(tx, userId, def.rewardCoins, 'mission_reward', idempotencyKey);
        await awardXp(tx, userId, def.rewardXp);
      }

      return { alreadyCompleted: false, progress: updated.progress, justCompleted };
    });

    return reply.send(result);
  });
}

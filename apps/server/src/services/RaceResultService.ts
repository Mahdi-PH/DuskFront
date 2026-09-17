import { randomUUID } from 'node:crypto';
import { ECONOMY_BALANCE } from '@velocity-island/shared';
import { prisma } from '../db.js';
import { creditCurrency } from './CurrencyService.js';
import { awardXp } from './ProgressionService.js';

export interface RaceParticipantResult {
  userId: string | null; // null for bots
  displayName: string;
  vehicleId: string;
  isBot: boolean;
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  driftDistanceMeters: number;
  powerUpsUsed: number;
  collisionCount: number;
}

/** Persists a finished race and its participants inside one transaction, credits
 * currency/XP to human participants (idempotent per race+user so a retried submission
 * from a reconnecting client never double-pays), updates player stats, and records a
 * new track record if the winner's best lap beats the current one. Server is the sole
 * source of truth here — the client-submitted result is data, not a command. */
export async function persistRaceResult(
  trackId: string,
  mode: string,
  totalLaps: number,
  participants: RaceParticipantResult[],
): Promise<{ raceId: string }> {
  const raceId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.race.create({
      data: { id: raceId, trackId, mode, totalLaps, finishedAt: new Date() },
    });

    for (const participant of participants) {
      const idempotencyKey = `race:${raceId}:${participant.userId ?? 'bot'}:${participant.displayName}`;
      await tx.raceParticipant.create({
        data: {
          raceId,
          userId: participant.userId,
          isBot: participant.isBot,
          displayName: participant.displayName,
          vehicleId: participant.vehicleId,
          position: participant.position,
          totalTimeMs: Math.round(participant.totalTimeMs),
          bestLapMs: Math.round(participant.bestLapMs),
          driftDistanceM: participant.driftDistanceMeters,
          powerUpsUsed: participant.powerUpsUsed,
          xpEarned: 0,
          coinsEarned: 0,
          idempotencyKey,
        },
      });

      if (participant.isBot || !participant.userId) continue;

      const coins = ECONOMY_BALANCE.coinsByPosition[participant.position - 1] ?? 10;
      const xpBase = ECONOMY_BALANCE.xpByPosition[participant.position - 1] ?? 10;
      const xpFromDrift = Math.round(participant.driftDistanceMeters * ECONOMY_BALANCE.xpPerDriftPoint);
      const xpFromPowerUps = participant.powerUpsUsed * ECONOMY_BALANCE.xpPerPowerUpUsed;
      const noCollisionBonus = participant.collisionCount === 0 ? ECONOMY_BALANCE.xpNoCollisionRaceBonus : 0;
      const xpEarned = xpBase + xpFromDrift + xpFromPowerUps + noCollisionBonus;

      await creditCurrency(tx, participant.userId, coins, 'race_reward', `race:${raceId}:${participant.userId}:currency`);
      await awardXp(tx, participant.userId, xpEarned);

      await tx.playerStat.update({
        where: { userId: participant.userId },
        data: {
          racesCompleted: { increment: 1 },
          racesWon: { increment: participant.position === 1 ? 1 : 0 },
          totalDriftMeters: { increment: participant.driftDistanceMeters },
          totalPowerUpsUsed: { increment: participant.powerUpsUsed },
        },
      });

      await tx.matchHistoryEntry.create({
        data: {
          userId: participant.userId,
          raceId,
          trackId,
          position: participant.position,
          totalTimeMs: Math.round(participant.totalTimeMs),
        },
      });

      const currentRecord = await tx.leaderboard.findFirst({
        where: { scope: 'track', trackId, userId: participant.userId },
        orderBy: { value: 'asc' },
      });
      if (!currentRecord || participant.bestLapMs < currentRecord.value) {
        await tx.leaderboard.create({
          data: {
            scope: 'track',
            trackId,
            userId: participant.userId,
            displayName: participant.displayName,
            value: Math.round(participant.bestLapMs),
          },
        });
      }
    }
  });

  return { raceId };
}

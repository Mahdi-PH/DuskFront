import type { Prisma } from '@prisma/client';
import { ACHIEVEMENTS, levelFromTotalXp } from '@velocity-island/shared';

/** Metrics an achievement can key off, sourced from PlayerStat + Profile rather than a
 * bespoke event log — every metric here is already tracked for other reasons (stats
 * screen, leveling), so achievements piggyback on that instead of duplicating state. */
async function currentMetricValues(tx: Prisma.TransactionClient, userId: string): Promise<Record<string, number>> {
  const [stat, profile, unlockCount] = await Promise.all([
    tx.playerStat.findUniqueOrThrow({ where: { userId } }),
    tx.profile.findUniqueOrThrow({ where: { userId } }),
    tx.vehicleUnlock.count({ where: { userId } }),
  ]);
  const levelInfo = levelFromTotalXp(profile.totalXp);

  return {
    totalDriftMeters: stat.totalDriftMeters,
    racesWon: stat.racesWon,
    racesCompleted: stat.racesCompleted,
    totalPowerUpsUsed: stat.totalPowerUpsUsed,
    perfectLaps: stat.perfectLaps,
    shortcutsTaken: stat.shortcutsTaken,
    lastToFirstFinishes: stat.lastToFirstFinishes,
    totalKmDriven: stat.totalKmDriven,
    playerLevel: levelInfo.level,
    vehiclesUnlocked: unlockCount,
    // Metrics without a dedicated column yet (topSpeedReachedKmh200, raceFinishedWithoutBraking,
    // distinctTracksWon, racesWithoutCollisionWon, rocketHits, attacksBlocked, dailyMissionsCompleted,
    // friendsAdded) are intentionally left out: awarding them from data we don't actually track
    // would be fake progress, so those achievements simply won't unlock until that tracking exists.
  };
}

/** Re-evaluates every achievement for a user against current stats and unlocks any
 * that just crossed their target. Called inside the same transaction as a race-result
 * write so unlock timing lines up with the stat update that caused it. Returns the
 * list of achievement ids newly unlocked (for a "achievement unlocked" toast, etc). */
export async function evaluateAchievements(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const metrics = await currentMetricValues(tx, userId);
  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    const value = metrics[achievement.metric];
    if (value === undefined || value < achievement.target) continue;

    const existing = await tx.playerAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    });
    if (existing?.unlockedAt) continue;

    await tx.playerAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
      update: { progress: value, unlockedAt: new Date() },
      create: { userId, achievementId: achievement.id, progress: value, unlockedAt: new Date() },
    });
    await tx.profile.update({ where: { userId }, data: { coins: { increment: achievement.rewardCoins } } });
    newlyUnlocked.push(achievement.id);
  }

  return newlyUnlocked;
}

import type { Prisma } from '@prisma/client';
import { levelFromTotalXp, ECONOMY_BALANCE } from '@velocity-island/shared';

export interface XpAwardResult {
  totalXp: number;
  level: number;
  leveledUp: boolean;
}

/** Awards XP and returns the resulting level info; the actual DB write happens inside
 * the caller's transaction so it can be combined atomically with currency + race
 * result persistence. */
export async function awardXp(tx: Prisma.TransactionClient, userId: string, xp: number): Promise<XpAwardResult> {
  const profile = await tx.profile.findUniqueOrThrow({ where: { userId } });
  const before = levelFromTotalXp(profile.totalXp).level;
  const newTotalXp = profile.totalXp + xp;
  const after = levelFromTotalXp(newTotalXp);
  const clampedLevel = Math.min(after.level, ECONOMY_BALANCE.level.maxLevel);

  await tx.profile.update({ where: { userId }, data: { totalXp: newTotalXp, level: clampedLevel } });

  return { totalXp: newTotalXp, level: clampedLevel, leveledUp: clampedLevel > before };
}

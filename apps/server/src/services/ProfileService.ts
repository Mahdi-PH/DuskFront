import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { VEHICLES } from '@velocity-island/shared';

/** Creates the default profile/settings/starter-vehicle-unlocks row set for a brand
 * new user (guest or email). Runs inside the same transaction as user creation so a
 * half-created account is never possible. */
export async function createDefaultProfileFor(
  tx: Prisma.TransactionClient,
  userId: string,
  displayName: string,
): Promise<void> {
  await tx.profile.create({
    data: { userId, displayName, level: 1, totalXp: 0, coins: 300, selectedVehicleId: 'wave', selectedColorwayId: 'ocean-blue' },
  });
  await tx.playerSettings.create({ data: { userId } });
  await tx.playerStat.create({ data: { userId } });

  const defaultVehicles = VEHICLES.filter((v) => v.unlock.type === 'default');
  await tx.vehicleUnlock.createMany({
    data: defaultVehicles.map((v) => ({ userId, vehicleId: v.id })),
    skipDuplicates: true,
  });
}

export async function getFullProfile(userId: string) {
  return prisma.profile.findUniqueOrThrow({ where: { userId } });
}

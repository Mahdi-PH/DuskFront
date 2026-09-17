import { PrismaClient } from '@prisma/client';
import { VEHICLES, TRACKS, ACHIEVEMENTS } from '@velocity-island/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const vehicle of VEHICLES) {
    await prisma.vehicleCatalogEntry.upsert({
      where: { id: vehicle.id },
      update: { name: vehicle.name },
      create: { id: vehicle.id, name: vehicle.name },
    });
  }

  for (const track of TRACKS) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: { name: track.name },
      create: { id: track.id, name: track.name },
    });
  }

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { id: achievement.id },
      update: { nameKey: achievement.nameKey },
      create: { id: achievement.id, nameKey: achievement.nameKey },
    });
  }

  console.log(`Seeded ${VEHICLES.length} vehicles, ${TRACKS.length} tracks, ${ACHIEVEMENTS.length} achievements.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

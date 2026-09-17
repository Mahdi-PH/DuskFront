import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VEHICLES, getVehicleById, levelFromTotalXp } from '@velocity-island/shared';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/requireAuth.js';

const settingsPatchSchema = z.object({
  locale: z.enum(['ar', 'en']).optional(),
  graphicsQuality: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
  masterVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  sfxVolume: z.number().min(0).max(1).optional(),
  cameraShakeEnabled: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  autoAccelerate: z.boolean().optional(),
  colorBlindMode: z.enum(['none', 'protanopia', 'deuteranopia', 'tritanopia']).optional(),
});

const vehicleSelectSchema = z.object({
  vehicleId: z.string().min(1),
  colorwayId: z.string().min(1),
});

export async function registerProfileRoutes(app: FastifyInstance): Promise<void> {
  app.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const profile = await prisma.profile.findUnique({ where: { userId: request.userId! } });
    if (!profile) return reply.code(404).send({ error: 'not_found' });
    const levelInfo = levelFromTotalXp(profile.totalXp);
    return reply.send({ ...profile, ...levelInfo });
  });

  app.get('/profile/settings', { preHandler: requireAuth }, async (request, reply) => {
    const settings = await prisma.playerSettings.findUnique({ where: { userId: request.userId! } });
    if (!settings) return reply.code(404).send({ error: 'not_found' });
    return reply.send(settings);
  });

  app.patch('/profile/settings', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = settingsPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const updated = await prisma.playerSettings.update({ where: { userId: request.userId! }, data: parsed.data });
    return reply.send(updated);
  });

  app.get('/profile/vehicles', { preHandler: requireAuth }, async (request, reply) => {
    const unlocks = await prisma.vehicleUnlock.findMany({ where: { userId: request.userId! } });
    const unlockedIds = new Set(unlocks.map((u) => u.vehicleId));
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: request.userId! } });
    const levelInfo = levelFromTotalXp(profile.totalXp);

    const vehicles = VEHICLES.map((v) => ({
      ...v,
      unlocked: v.unlock.type === 'default' || unlockedIds.has(v.id) || (v.unlock.type === 'level' && levelInfo.level >= v.unlock.level),
    }));
    return reply.send(vehicles);
  });

  app.patch('/profile/vehicle', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = vehicleSelectSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const vehicle = getVehicleById(parsed.data.vehicleId);
    if (!vehicle.colorways.includes(parsed.data.colorwayId)) {
      return reply.code(400).send({ error: 'invalid_colorway' });
    }

    if (vehicle.unlock.type === 'level') {
      const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: request.userId! } });
      const levelInfo = levelFromTotalXp(profile.totalXp);
      if (levelInfo.level < vehicle.unlock.level) return reply.code(403).send({ error: 'vehicle_locked' });
    } else if (vehicle.unlock.type === 'coins') {
      const owned = await prisma.vehicleUnlock.findUnique({
        where: { userId_vehicleId: { userId: request.userId!, vehicleId: vehicle.id } },
      });
      if (!owned) return reply.code(403).send({ error: 'vehicle_locked' });
    }

    const updated = await prisma.profile.update({
      where: { userId: request.userId! },
      data: { selectedVehicleId: parsed.data.vehicleId, selectedColorwayId: parsed.data.colorwayId },
    });
    return reply.send(updated);
  });
}

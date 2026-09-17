import { z } from 'zod';

export const privateLobbySettingsSchema = z.object({
  trackId: z.string().min(1),
  laps: z.number().int().min(1).max(5),
  botCount: z.number().int().min(0).max(7),
  aiDifficulty: z.enum(['easy', 'normal', 'hard', 'expert']),
});

export const roomCodeSchema = z
  .string()
  .length(6)
  .regex(/^[A-Z0-9]{6}$/);

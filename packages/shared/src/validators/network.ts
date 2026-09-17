import { z } from 'zod';

export const raceInputSchema = z.object({
  seq: z.number().int().nonnegative(),
  clientTimeMs: z.number().nonnegative(),
  throttle: z.number().min(0).max(1),
  brake: z.number().min(0).max(1),
  steer: z.number().min(-1).max(1),
  drift: z.boolean(),
  boost: z.boolean(),
  usePowerUp: z.boolean(),
});

export type RaceInputInput = z.infer<typeof raceInputSchema>;

export const joinRoomOptionsSchema = z.object({
  vehicleId: z.string().min(1).max(32),
  displayName: z.string().min(1).max(24),
  colorwayId: z.string().min(1).max(32),
});

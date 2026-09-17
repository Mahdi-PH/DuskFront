import { z } from 'zod';

export const emailRegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_؀-ۿ ]+$/, 'invalid display name characters'),
});

export const emailLoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const guestUpgradeSchema = emailRegisterSchema;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

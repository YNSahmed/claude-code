import { z } from 'zod';

const phone = z.string().trim().regex(/^\+91[6-9][0-9]{9}$/, 'Use an Indian mobile number like +919876543210.');

export const registerSchema = z.strictObject({
  phone,
  password: z.string().min(10, 'Use at least 10 characters.').max(128),
  displayName: z.string().trim().min(2).max(32),
});

export const loginSchema = z.strictObject({
  phone,
  password: z.string().min(1).max(128),
});

export const freeFireUidSchema = z.strictObject({
  freeFireUid: z.string().trim().regex(/^[0-9]{6,12}$/, 'Free Fire UIDs are 6–12 digits.'),
});

export const userIdParams = z.object({ id: z.uuid() });

export const kycSchema = z.strictObject({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
});

export const banSchema = z.strictObject({
  banned: z.boolean(),
  reason: z.string().trim().min(3).max(200),
});

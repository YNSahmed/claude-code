import { z } from 'zod';

import { indianMobileSchema } from '../../utils/pii.js';

export const requestOtpSchema = z.strictObject({
  phone: indianMobileSchema,
});

export const verifyOtpSchema = z.strictObject({
  phone: indianMobileSchema,
  code: z.string().trim().regex(/^[0-9]{6}$/, 'Enter the 6-digit code.'),
});

export const updateProfileSchema = z.strictObject({
  displayName: z.string().trim().min(2, 'Use at least 2 characters.').max(32),
});

export const userIdParams = z.object({ id: z.uuid() });

export const listUsersQuery = z.object({
  search: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const kycSchema = z.strictObject({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
});

export const banSchema = z.strictObject({
  banned: z.boolean(),
  reason: z.string().trim().min(3).max(200),
});

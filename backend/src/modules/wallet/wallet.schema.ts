import { z } from 'zod';

import { env } from '../../config/env.js';

/** UPI virtual payment address, e.g. "name.surname@okaxis". */
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$/;

export const createDepositOrderSchema = z.strictObject({
  amount: z
    .number()
    .int('Amount must be a whole number of tokens.')
    .min(env.MIN_DEPOSIT, `The minimum deposit is ${env.MIN_DEPOSIT} tokens.`)
    .max(env.MAX_DEPOSIT, `The maximum deposit is ${env.MAX_DEPOSIT} tokens.`),
});

export const withdrawSchema = z.strictObject({
  amount: z
    .number()
    .int('Amount must be a whole number of tokens.')
    .min(env.MIN_WITHDRAWAL, `The minimum withdrawal is ${env.MIN_WITHDRAWAL} tokens.`)
    .max(env.MAX_WITHDRAWAL, `The maximum withdrawal is ${env.MAX_WITHDRAWAL} tokens.`),
  upiId: z.string().trim().regex(UPI_ID_PATTERN, 'Enter a valid UPI ID, e.g. name@okaxis.'),
});

export const transactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Ledger entry id to page backwards from. */
  before: z.coerce.number().int().positive().optional(),
});

export const withdrawalIdParams = z.object({ id: z.uuid() });

export const adminWithdrawalsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'REJECTED']).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const approveWithdrawalSchema = z.strictObject({
  /** Reference of the UPI payout made to the player (UTR or payout id). */
  payoutReference: z.string().trim().min(3).max(100),
});

export const rejectWithdrawalSchema = z.strictObject({
  reason: z.string().trim().min(3).max(200),
});

export const grantBonusSchema = z.strictObject({
  userId: z.uuid(),
  amount: z.number().int().min(1).max(10_000),
  reason: z.string().trim().min(3).max(200),
});

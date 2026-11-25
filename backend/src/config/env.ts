import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true });

const boolean = z.enum(['true', 'false']).transform((value) => value === 'true');
const tokens = z.coerce.number().int().nonnegative();

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection URL'),
    DATABASE_SSL: boolean.default(false),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    JWT_ISSUER: z.string().min(1).default('ff-arena-api'),
    JWT_AUDIENCE: z.string().min(1).default('ff-arena-app'),
    JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),

    ROOM_CREDENTIALS_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes of hex (openssl rand -hex 32)'),

    PAYMENT_GATEWAY: z.enum(['razorpay', 'mock']).default('razorpay'),
    RAZORPAY_KEY_ID: z.string().min(1),
    RAZORPAY_KEY_SECRET: z.string().min(1),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(16, 'must be at least 16 characters'),

    MIN_DEPOSIT: tokens.min(1).default(10),
    MAX_DEPOSIT: tokens.default(10_000),
    MIN_WITHDRAWAL: tokens.min(1).default(100),
    MAX_WITHDRAWAL: tokens.default(10_000),
    TDS_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(3000),
    WITHDRAWAL_FEE_BPS: z.coerce.number().int().min(0).max(5000).default(0),
    ALLOW_WINNINGS_FOR_ENTRY: boolean.default(true),
    REGISTRATION_CLOSE_MINUTES: z.coerce.number().int().min(0).max(1440).default(5),
  })
  .refine((e) => e.MIN_DEPOSIT <= e.MAX_DEPOSIT, { message: 'MIN_DEPOSIT must be <= MAX_DEPOSIT', path: ['MIN_DEPOSIT'] })
  .refine((e) => e.MIN_WITHDRAWAL <= e.MAX_WITHDRAWAL, {
    message: 'MIN_WITHDRAWAL must be <= MAX_WITHDRAWAL',
    path: ['MIN_WITHDRAWAL'],
  })
  .refine((e) => e.TDS_RATE_BPS + e.WITHDRAWAL_FEE_BPS < 10_000, {
    message: 'TDS_RATE_BPS + WITHDRAWAL_FEE_BPS must leave something to pay out',
    path: ['TDS_RATE_BPS'],
  })
  .refine((e) => !(e.NODE_ENV === 'production' && e.PAYMENT_GATEWAY === 'mock'), {
    message: 'the mock payment gateway is not allowed in production',
    path: ['PAYMENT_GATEWAY'],
  });

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Only names and rule messages are printed, never the values.
    const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}

export const env = loadEnv();
export type Env = typeof env;

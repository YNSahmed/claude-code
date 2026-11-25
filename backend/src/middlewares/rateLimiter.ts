import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';

import { AppError } from '../utils/errors.js';

/**
 * Rate limits. The default in-memory store is per process: when running more than one instance,
 * plug in a shared store (for example rate-limit-redis) so limits apply across all of them.
 */

const common: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Slow down and try again shortly.')),
};

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');
/** Per signed-in user (these limiters run after requireAuth), falling back to the IP. */
const byUser = (req: Request) => (req.user ? `user:${req.user.id}` : byIp(req));

/** Everything: a generous ceiling against floods and scraping. */
export const globalLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 300, keyGenerator: byIp });

/** Sign-in and sign-up, per IP. */
export const authIpLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 30, keyGenerator: byIp });

/** Sign-in attempts per phone number, against password guessing from many IPs. */
export const authAccountLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 8,
  keyGenerator: (req) => {
    const phone: unknown = (req.body as { phone?: unknown } | undefined)?.phone;
    return typeof phone === 'string' ? `phone:${phone.slice(0, 20)}` : byIp(req);
  },
});

/** Joining tournaments. */
export const joinLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 10, keyGenerator: byUser });

/** Creating deposit orders. */
export const depositLimiter = rateLimit({ ...common, windowMs: 10 * 60_000, limit: 10, keyGenerator: byUser });

/** Withdrawal requests. */
export const withdrawLimiter = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 5, keyGenerator: byUser });

/** Gateway webhooks, per source IP. High, since gateways retry in bursts. */
export const webhookLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 600, keyGenerator: byIp });

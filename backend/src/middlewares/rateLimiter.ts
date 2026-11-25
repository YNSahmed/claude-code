import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';

import { AppError } from '../utils/errors.js';
import { normalizeIndianMobile } from '../utils/pii.js';

/**
 * Rate limits. The default in-memory store is per process: when running more than one instance,
 * plug in a shared store (for example rate-limit-redis) so limits apply across all of them.
 * (Login codes are also throttled per number in the database, which holds across instances.)
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

/** Asking for login codes, per IP (stops SMS-bombing many numbers from one place). */
export const otpRequestIpLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 20, keyGenerator: byIp });

/** Entering login codes, per IP. */
export const otpVerifyIpLimiter = rateLimit({ ...common, windowMs: 15 * 60_000, limit: 40, keyGenerator: byIp });

/** Requests and guesses per phone number, whichever IP they come from. */
export const otpPhoneLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60_000,
  limit: 15,
  keyGenerator: (req) => {
    const raw: unknown = (req.body as { phone?: unknown } | undefined)?.phone;
    const phone = typeof raw === 'string' ? normalizeIndianMobile(raw) : null;
    return phone ? `phone:${phone}` : byIp(req);
  },
});

/** Registering or withdrawing squads. */
export const squadLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 10, keyGenerator: byUser });

/** Joining tournaments (wallet mode). */
export const joinLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 10, keyGenerator: byUser });

/** Creating deposit orders. */
export const depositLimiter = rateLimit({ ...common, windowMs: 10 * 60_000, limit: 10, keyGenerator: byUser });

/** Withdrawal requests. */
export const withdrawLimiter = rateLimit({ ...common, windowMs: 60 * 60_000, limit: 5, keyGenerator: byUser });

/** Gateway webhooks, per source IP. High, since gateways retry in bursts. */
export const webhookLimiter = rateLimit({ ...common, windowMs: 60_000, limit: 600, keyGenerator: byIp });

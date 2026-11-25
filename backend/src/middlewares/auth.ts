import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export type Role = 'player' | 'admin';

export interface AuthUser {
  id: string;
  role: Role;
}

const tokenPayload = z.object({
  sub: z.uuid(),
  ver: z.number().int().nonnegative(),
});

export function signAccessToken(user: { id: string; tokenVersion: number }): string {
  return jwt.sign({ ver: user.tokenVersion }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user.id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_TTL_SECONDS,
  });
}

/**
 * Verifies the Bearer token, then loads the user from the database on every request so that
 * bans, role changes and token revocation (token_version) apply immediately.
 * The role always comes from the database, never from the token.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let claims: z.infer<typeof tokenPayload>;
  try {
    const decoded = jwt.verify(header.slice('Bearer '.length).trim(), env.JWT_SECRET, {
      algorithms: ['HS256'], // Pinned: rejects "none" and algorithm-confusion tokens.
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    claims = tokenPayload.parse(decoded);
  } catch {
    throw unauthorized('Your session has expired. Sign in again.');
  }

  const { rows } = await pool.query<{ id: string; role: Role; is_banned: boolean; token_version: number }>(
    'SELECT id, role, is_banned, token_version FROM users WHERE id = $1',
    [claims.sub]
  );
  const user = rows[0];
  if (!user || user.token_version !== claims.ver) throw unauthorized('Your session has expired. Sign in again.');
  if (user.is_banned) throw forbidden('ACCOUNT_BANNED', 'This account has been suspended.');

  req.user = { id: user.id, role: user.role };
  next();
}

/** Allows the request only for the given roles. Use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden('FORBIDDEN', 'You do not have permission to do this.');
    next();
  };
}

/** The authenticated user. Only call in handlers that run after requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

import { randomInt } from 'node:crypto';

import { pool, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { signAccessToken, type Role } from '../../middlewares/auth.js';
import { recordAdminAction } from '../../utils/audit.js';
import { keyedHash, safeEqualHex } from '../../utils/crypto.js';
import { AppError, conflict, forbidden, notFound } from '../../utils/errors.js';
import { otpHashKey } from '../../utils/pii.js';
import { sendOtpSms } from './sms.js';

/** Seconds before another code can be sent to the same number. */
const RESEND_COOLDOWN_SECONDS = 30;
/** Codes per number per hour. With 5 tries each, that is at most 25 guesses an hour out of a million. */
const MAX_CODES_PER_HOUR = 5;

interface UserRow {
  id: string;
  phone: string;
  display_name: string | null;
  role: Role;
  kyc_status: string;
  is_banned: boolean;
  token_version: number;
  created_at: Date;
}

export function toUserDto(user: UserRow) {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.display_name,
    role: user.role,
    /** True until the player has chosen a display name. */
    needsProfile: user.display_name === null,
    createdAt: user.created_at,
  };
}

const hashCode = (phone: string, code: string) => keyedHash(otpHashKey, `${phone}:${code}`);

/**
 * Sends a 6-digit login code. Throttled per number in the database (so it holds across servers):
 * one code every 30 seconds and five per hour. The response is the same whether or not the number
 * already has an account, so it cannot be used to find out who is registered.
 */
export async function requestOtp(phone: string, ip: string | undefined) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

  const challengeId = await withTransaction(async (client) => {
    // Serialize requests for the same number so two taps cannot both pass the throttle.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`otp:${phone}`]);
    const { rows } = await client.query<{ last_hour: number; retry_after: number | null }>(
      `SELECT count(*)::int AS last_hour,
              CEIL(EXTRACT(EPOCH FROM (max(created_at) + make_interval(secs => $2) - now())))::int AS retry_after
         FROM otp_challenges
        WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
      [phone, RESEND_COOLDOWN_SECONDS]
    );
    const recent = rows[0];
    if (recent && recent.retry_after !== null && recent.retry_after > 0) {
      throw new AppError(429, 'OTP_COOLDOWN', `Wait ${recent.retry_after} seconds before asking for a new code.`, {
        retryAfterSeconds: recent.retry_after,
      });
    }
    if (recent && recent.last_hour >= MAX_CODES_PER_HOUR) {
      throw new AppError(429, 'OTP_LIMIT', 'Too many codes requested for this number. Try again in an hour.');
    }
    const { rows: inserted } = await client.query<{ id: string }>(
      `INSERT INTO otp_challenges (phone, code_hash, expires_at, request_ip)
       VALUES ($1, $2, now() + make_interval(secs => $3), $4)
       RETURNING id`,
      [phone, hashCode(phone, code), env.OTP_TTL_SECONDS, ip ?? null]
    );
    return (inserted[0] as { id: string }).id;
  });

  try {
    await sendOtpSms(phone, code);
  } catch (error) {
    // Let the player retry straight away instead of waiting out the cooldown.
    await pool.query('DELETE FROM otp_challenges WHERE id = $1', [challengeId]);
    throw error;
  }

  return { sent: true, expiresInSeconds: env.OTP_TTL_SECONDS, resendInSeconds: RESEND_COOLDOWN_SECONDS };
}

type VerifyOutcome =
  | { ok: true; user: UserRow; isNewUser: boolean }
  | { ok: false; error: AppError };

/**
 * Checks the latest code for the number. Wrong guesses are counted (and committed) before the
 * error is returned; after OTP_MAX_ATTEMPTS the code is dead. A correct code is single-use.
 * First sign-in creates the account (and its wallet). Numbers in ADMIN_PHONES become admins.
 */
export async function verifyOtp(phone: string, code: string) {
  const outcome = await withTransaction<VerifyOutcome>(async (client) => {
    const { rows } = await client.query<{ id: string; code_hash: string; attempts: number; usable: boolean }>(
      `SELECT id, code_hash, attempts, (consumed_at IS NULL AND expires_at > now()) AS usable
         FROM otp_challenges
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT 1
          FOR UPDATE`,
      [phone]
    );
    const challenge = rows[0];
    if (!challenge || !challenge.usable) {
      return { ok: false, error: new AppError(400, 'OTP_EXPIRED', 'This code has expired. Ask for a new one.') };
    }
    if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
      return { ok: false, error: new AppError(429, 'OTP_LOCKED', 'Too many wrong tries. Ask for a new code.') };
    }
    if (!safeEqualHex(hashCode(phone, code), challenge.code_hash)) {
      await client.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [challenge.id]);
      const attemptsLeft = env.OTP_MAX_ATTEMPTS - challenge.attempts - 1;
      return {
        ok: false,
        error: new AppError(400, 'OTP_INVALID', 'That code is not right.', { attemptsLeft: Math.max(0, attemptsLeft) }),
      };
    }

    await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [challenge.id]);

    const role: Role = env.ADMIN_PHONES.includes(phone) ? 'admin' : 'player';
    const { rows: users } = await client.query<UserRow & { inserted: boolean }>(
      `INSERT INTO users (phone, role, phone_verified_at)
       VALUES ($1, $2, now())
       ON CONFLICT (phone) DO UPDATE
         SET phone_verified_at = COALESCE(users.phone_verified_at, now()),
             role = CASE WHEN $2 = 'admin' THEN 'admin' ELSE users.role END
       RETURNING *, (xmax = 0) AS inserted`,
      [phone, role]
    );
    const user = users[0] as UserRow & { inserted: boolean };
    if (user.inserted) await client.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    return { ok: true, user, isNewUser: user.inserted };
  });

  if (!outcome.ok) throw outcome.error;
  if (outcome.user.is_banned) throw forbidden('ACCOUNT_BANNED', 'This account has been suspended.');

  return {
    accessToken: signAccessToken({ id: outcome.user.id, tokenVersion: outcome.user.token_version }),
    user: toUserDto(outcome.user),
    isNewUser: outcome.isNewUser,
  };
}

export async function getProfile(userId: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw notFound('User');
  return { user: toUserDto(rows[0]) };
}

export async function updateProfile(userId: string, displayName: string) {
  const { rows } = await pool.query<UserRow>('UPDATE users SET display_name = $2 WHERE id = $1 RETURNING *', [userId, displayName]);
  if (!rows[0]) throw notFound('User');
  return { user: toUserDto(rows[0]) };
}

/** Signs out of every device by invalidating all existing tokens. */
export async function signOutEverywhere(userId: string) {
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

export async function listUsers(query: { search?: string | undefined; limit: number }) {
  const search = query.search ? `%${query.search.replace(/[%_\\]/g, '\\$&')}%` : null;
  const { rows } = await pool.query<UserRow & { squads: number }>(
    `SELECT u.*, (SELECT count(*)::int FROM squads s WHERE s.captain_id = u.id) AS squads
       FROM users u
      WHERE $1::text IS NULL OR u.phone LIKE $1 OR u.display_name ILIKE $1
      ORDER BY u.created_at DESC
      LIMIT $2`,
    [search, query.limit]
  );
  return rows.map((u) => ({ ...toUserDto(u), isBanned: u.is_banned, squadsRegistered: u.squads }));
}

export async function setKycStatus(adminId: string, userId: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>('UPDATE users SET kyc_status = $2 WHERE id = $1 RETURNING *', [userId, status]);
    if (!rows[0]) throw notFound('User');
    await recordAdminAction(client, { adminId, action: 'KYC_STATUS_SET', targetType: 'user', targetId: userId, details: { status } });
    return toUserDto(rows[0]);
  });
}

/** Banning also bumps token_version, which signs the user out everywhere. */
export async function setBanned(adminId: string, userId: string, banned: boolean, reason: string) {
  if (adminId === userId) throw conflict('CANNOT_BAN_SELF', 'You cannot ban your own account.');
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `UPDATE users SET is_banned = $2, token_version = token_version + CASE WHEN $2 THEN 1 ELSE 0 END
        WHERE id = $1 RETURNING *`,
      [userId, banned]
    );
    if (!rows[0]) throw notFound('User');
    await recordAdminAction(client, {
      adminId,
      action: banned ? 'USER_BANNED' : 'USER_UNBANNED',
      targetType: 'user',
      targetId: userId,
      details: { reason },
    });
    return toUserDto(rows[0]);
  });
}

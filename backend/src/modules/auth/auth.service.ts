import { pool, withTransaction } from '../../config/db.js';
import { signAccessToken, type Role } from '../../middlewares/auth.js';
import { recordAdminAction } from '../../utils/audit.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../../utils/crypto.js';
import { AppError, conflict, forbidden, notFound } from '../../utils/errors.js';
import { getBalance } from '../wallet/wallet.service.js';

interface UserRow {
  id: string;
  phone: string;
  password_hash: string;
  display_name: string;
  role: Role;
  free_fire_uid: string | null;
  free_fire_uid_verified_at: Date | null;
  kyc_status: string;
  is_banned: boolean;
  token_version: number;
  created_at: Date;
}

function toUserDto(user: UserRow) {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.display_name,
    role: user.role,
    freeFireUid: user.free_fire_uid,
    freeFireUidVerified: user.free_fire_uid_verified_at !== null,
    kycStatus: user.kyc_status,
    createdAt: user.created_at,
  };
}

function session(user: UserRow) {
  return { accessToken: signAccessToken({ id: user.id, tokenVersion: user.token_version }), user: toUserDto(user) };
}

/** Creates the user and their wallet together, so a user never exists without a wallet. */
export async function register(input: { phone: string; password: string; displayName: string }) {
  const passwordHash = await hashPassword(input.password);
  const user = await withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (phone, password_hash, display_name) VALUES ($1, $2, $3) RETURNING *`,
      [input.phone, passwordHash, input.displayName]
    );
    const created = rows[0] as UserRow;
    await client.query('INSERT INTO wallets (user_id) VALUES ($1)', [created.id]);
    return created;
  });
  return session(user);
}

export async function login(input: { phone: string; password: string }) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE phone = $1', [input.phone]);
  const user = rows[0];
  // Always run one scrypt check so response time does not reveal whether the phone is registered.
  const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong phone number or password.');
  if (user.is_banned) throw forbidden('ACCOUNT_BANNED', 'This account has been suspended.');
  return session(user);
}

export async function getProfile(userId: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw notFound('User');
  return { user: toUserDto(rows[0]), wallet: await getBalance(userId) };
}

/**
 * Sets the player's Free Fire UID (it then needs admin verification again).
 * Locked while the player has an entry in an OPEN, LOCKED or LIVE tournament, so the UID that
 * was checked at join time is the one used in the room. Pairs with the FOR SHARE in joinTournament.
 */
export async function setFreeFireUid(userId: string, freeFireUid: string) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw notFound('User');
    if (user.free_fire_uid === freeFireUid) return toUserDto(user);

    const { rowCount: activeEntries } = await client.query(
      `SELECT 1
         FROM tournament_participants p
         JOIN tournaments t ON t.id = p.tournament_id
        WHERE p.user_id = $1 AND p.status = 'CONFIRMED' AND t.status IN ('OPEN', 'LOCKED', 'LIVE')
        LIMIT 1`,
      [userId]
    );
    if (activeEntries) {
      throw conflict('UID_LOCKED', 'You cannot change your UID while registered in an upcoming or live tournament.');
    }

    const { rows: updated } = await client.query<UserRow>(
      `UPDATE users SET free_fire_uid = $2, free_fire_uid_verified_at = NULL WHERE id = $1 RETURNING *`,
      [userId, freeFireUid]
    );
    return toUserDto(updated[0] as UserRow);
  });
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

export async function verifyFreeFireUid(adminId: string, userId: string) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `UPDATE users SET free_fire_uid_verified_at = now()
        WHERE id = $1 AND free_fire_uid IS NOT NULL
        RETURNING *`,
      [userId]
    );
    if (!rows[0]) throw conflict('NO_UID', 'This user has not added a Free Fire UID.');
    await recordAdminAction(client, {
      adminId,
      action: 'UID_VERIFIED',
      targetType: 'user',
      targetId: userId,
      details: { freeFireUid: rows[0].free_fire_uid },
    });
    return toUserDto(rows[0]);
  });
}

export async function setKycStatus(adminId: string, userId: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>('UPDATE users SET kyc_status = $2 WHERE id = $1 RETURNING *', [userId, status]);
    if (!rows[0]) throw notFound('User');
    await recordAdminAction(client, { adminId, action: 'KYC_STATUS_SET', targetType: 'user', targetId: userId, details: { status } });
    return toUserDto(rows[0]);
  });
}

/** Banning also bumps token_version, which revokes every access token the user holds. */
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

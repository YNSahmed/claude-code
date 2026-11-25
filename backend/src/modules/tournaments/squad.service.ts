import { pool, withTransaction, type DbClient } from '../../config/db.js';
import { env } from '../../config/env.js';
import type { AuthUser } from '../../middlewares/auth.js';
import { recordAdminAction } from '../../utils/audit.js';
import { decryptSecret } from '../../utils/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { decryptPii, encryptPii, hashPhone, maskPhone } from '../../utils/pii.js';
import { TEAM_SIZE, type RegisterSquadInput, type TournamentStatus } from './tournament.schema.js';
import { lockTournament, toTournamentDto, type TournamentRow } from './tournament.service.js';

/**
 * Who can see what:
 *  - Everyone:          squad names (tournament page, leaderboard).
 *  - Squad captain:     their own squad, every member's name and number (they entered them).
 *  - Squad member:      their squad's names; only their own number. (Members who sign in with
 *                       the number their captain entered see the squad in "My squads".)
 *  - Organizer (admin): everything, for running the tournament.
 * Phone numbers are stored encrypted and matched by a keyed hash.
 */

interface SquadRow {
  id: string;
  tournament_id: string;
  captain_id: string;
  name: string;
  slot_number: number;
  placement: number | null;
  kills: number | null;
  created_at: Date;
}

interface MemberRow {
  squad_id: string;
  position: number;
  name: string;
  phone_encrypted: string;
  phone_hash: string;
  free_fire_uid: string | null;
}

async function loadMembers(db: DbClient | typeof pool, squadIds: string[]): Promise<Map<string, MemberRow[]>> {
  const { rows } = await db.query<MemberRow>(
    `SELECT squad_id, position, name, phone_encrypted, phone_hash, free_fire_uid
       FROM squad_members WHERE squad_id = ANY($1::uuid[]) ORDER BY position`,
    [squadIds]
  );
  const grouped = new Map<string, MemberRow[]>();
  for (const row of rows) grouped.set(row.squad_id, [...(grouped.get(row.squad_id) ?? []), row]);
  return grouped;
}

type Viewer = 'captain' | 'member' | 'admin';

function toSquadDto(squad: SquadRow, members: MemberRow[], viewer: Viewer, viewerPhoneHash?: string) {
  return {
    id: squad.id,
    name: squad.name,
    slotNumber: squad.slot_number,
    placement: squad.placement,
    kills: squad.kills,
    registeredAt: squad.created_at,
    myRole: viewer,
    members: members.map((m) => {
      const isMe = m.phone_hash === viewerPhoneHash;
      const canSeeNumber = viewer !== 'member' || isMe;
      const phone = canSeeNumber ? decryptPii(m.phone_encrypted) : null;
      return {
        position: m.position,
        name: m.name,
        isCaptain: m.position === 1,
        isMe,
        phone: viewer === 'admin' || viewer === 'captain' || isMe ? phone : null,
        phoneMasked: phone ? maskPhone(phone) : null,
        freeFireUid: viewer === 'member' && !isMe ? null : m.free_fire_uid,
      };
    }),
  };
}

async function userPhone(db: DbClient | typeof pool, userId: string): Promise<string> {
  const { rows } = await db.query<{ phone: string }>('SELECT phone FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw notFound('User');
  return rows[0].phone;
}

/** The squad the user belongs to in a tournament, as captain or as a member, with their role. */
async function findUserSquad(db: DbClient | typeof pool, userId: string, tournamentId: string) {
  const phoneHash = hashPhone(await userPhone(db, userId));
  const { rows } = await db.query<SquadRow & { is_captain: boolean }>(
    `SELECT s.*, (s.captain_id = $2) AS is_captain
       FROM squads s
      WHERE s.tournament_id = $1
        AND (s.captain_id = $2 OR EXISTS (
              SELECT 1 FROM squad_members m WHERE m.squad_id = s.id AND m.phone_hash = $3))
      LIMIT 1`,
    [tournamentId, userId, phoneHash]
  );
  return rows[0] ? { squad: rows[0] as SquadRow, isCaptain: rows[0].is_captain, phoneHash } : null;
}

// =============================================================================================
// Players
// =============================================================================================

/**
 * Registers a squad, atomically:
 *  1. Lock the tournament row (FOR UPDATE) so concurrent registrations cannot overfill it.
 *  2. Check registration is open and a team spot is free.
 *  3. The captain is member 1 with the phone number verified at sign-in (never taken from the
 *     request). Teammates' numbers must be distinct and not already in another squad.
 *  4. Store members with encrypted numbers, take the lowest free team number, update the count.
 */
export async function registerSquad(userId: string, tournamentId: string, input: RegisterSquadInput) {
  try {
    return await withTransaction(async (client) => {
      const t = await lockTournament(client, tournamentId);
      if (t.status !== 'OPEN' || t.registration_closed) {
        throw conflict('REGISTRATION_CLOSED', 'Registration for this tournament is closed.');
      }
      const teamSize = TEAM_SIZE[t.mode];
      if (t.filled_slots + teamSize > t.max_slots) throw conflict('TOURNAMENT_FULL', 'All team spots are taken.');
      if (input.teammates.length !== teamSize - 1) {
        throw badRequest('WRONG_TEAM_SIZE', `A ${t.mode.toLowerCase()} team needs ${teamSize - 1} teammate(s) besides you.`);
      }

      const captainPhone = await userPhone(client, userId);
      const members = [
        { position: 1, name: input.captain.name, phone: captainPhone, freeFireUid: input.captain.freeFireUid ?? null },
        ...input.teammates.map((m, i) => ({ position: i + 2, name: m.name, phone: m.phone, freeFireUid: m.freeFireUid ?? null })),
      ];

      const phones = members.map((m) => m.phone);
      if (new Set(phones).size !== phones.length) {
        throw badRequest('DUPLICATE_PHONE', 'Each member needs a different mobile number.');
      }
      const uids = members.flatMap((m) => (m.freeFireUid ? [m.freeFireUid] : []));
      if (new Set(uids).size !== uids.length) throw badRequest('DUPLICATE_UID', 'Each member needs a different Free Fire UID.');

      const hashes = members.map((m) => hashPhone(m.phone));
      const { rows: taken } = await client.query<{ phone_hash: string }>(
        'SELECT phone_hash FROM squad_members WHERE tournament_id = $1 AND phone_hash = ANY($2::text[])',
        [t.id, hashes]
      );
      if (taken.some((row) => row.phone_hash === hashes[0])) {
        throw conflict('ALREADY_REGISTERED', 'You are already in a squad for this tournament.');
      }
      if (taken.length > 0) {
        // Say which of *their own* entries is the problem, never which squad has that number.
        const positions = members.filter((_, i) => taken.some((row) => row.phone_hash === hashes[i])).map((m) => m.position);
        throw conflict('MEMBER_ALREADY_REGISTERED', 'Someone in your squad is already registered in this tournament.', { positions });
      }

      const { rows: slotRows } = await client.query<{ slot: number }>(
        `SELECT s AS slot FROM generate_series(1, $2::int) AS s
          WHERE NOT EXISTS (SELECT 1 FROM squads WHERE tournament_id = $1 AND slot_number = s)
          ORDER BY s LIMIT 1`,
        [t.id, t.max_slots / teamSize]
      );
      const slot = slotRows[0]?.slot;
      if (!slot) throw conflict('TOURNAMENT_FULL', 'All team spots are taken.');

      const { rows: inserted } = await client.query<SquadRow>(
        `INSERT INTO squads (tournament_id, captain_id, name, slot_number) VALUES ($1, $2, $3, $4) RETURNING *`,
        [t.id, userId, input.squadName, slot]
      );
      const squad = inserted[0] as SquadRow;
      await client.query(
        `INSERT INTO squad_members (squad_id, tournament_id, position, name, phone_encrypted, phone_hash, free_fire_uid)
         SELECT $1, $2, m.position, m.name, m.phone_encrypted, m.phone_hash, m.free_fire_uid
           FROM unnest($3::smallint[], $4::text[], $5::text[], $6::text[], $7::text[])
             AS m(position, name, phone_encrypted, phone_hash, free_fire_uid)`,
        [
          squad.id,
          t.id,
          members.map((m) => m.position),
          members.map((m) => m.name),
          members.map((m) => encryptPii(m.phone)),
          hashes,
          members.map((m) => m.freeFireUid),
        ]
      );
      await client.query('UPDATE tournaments SET filled_slots = filled_slots + $2 WHERE id = $1', [t.id, teamSize]);

      const memberRows = (await loadMembers(client, [squad.id])).get(squad.id) ?? [];
      return { squad: toSquadDto(squad, memberRows, 'captain', hashPhone(captainPhone)) };
    });
  } catch (error) {
    if ((error as { constraint?: string }).constraint === 'squad_members_one_squad_per_phone') {
      throw conflict('MEMBER_ALREADY_REGISTERED', 'Someone in your squad is already registered in this tournament.');
    }
    throw error;
  }
}

export async function getMySquad(userId: string, tournamentId: string) {
  const found = await findUserSquad(pool, userId, tournamentId);
  if (!found) return { squad: null };
  const members = (await loadMembers(pool, [found.squad.id])).get(found.squad.id) ?? [];
  return { squad: toSquadDto(found.squad, members, found.isCaptain ? 'captain' : 'member', found.phoneHash) };
}

/** The captain withdraws their squad while registration is open. Members' data is deleted. */
export async function withdrawSquad(userId: string, tournamentId: string) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status !== 'OPEN') throw conflict('REGISTRATION_CLOSED', 'You can only withdraw while registration is open.');
    const { rows } = await client.query<{ id: string }>(
      'DELETE FROM squads WHERE tournament_id = $1 AND captain_id = $2 RETURNING id',
      [t.id, userId]
    );
    if (!rows[0]) throw notFound('Your squad');
    await client.query('UPDATE tournaments SET filled_slots = filled_slots - $2 WHERE id = $1', [t.id, TEAM_SIZE[t.mode]]);
    return { withdrawn: true };
  });
}

/** Every tournament the user is in, as captain or member. */
export async function listMyRegistrations(userId: string) {
  const phoneHash = hashPhone(await userPhone(pool, userId));
  const { rows } = await pool.query<TournamentRow & { squad_id: string; squad_name: string; slot_number: number; placement: number | null; kills: number | null; is_captain: boolean }>(
    `SELECT t.*, s.id AS squad_id, s.name AS squad_name, s.slot_number, s.placement, s.kills, (s.captain_id = $1) AS is_captain
       FROM squads s
       JOIN tournaments t ON t.id = s.tournament_id
      WHERE s.captain_id = $1
         OR EXISTS (SELECT 1 FROM squad_members m WHERE m.squad_id = s.id AND m.phone_hash = $2)
      ORDER BY t.starts_at DESC
      LIMIT 100`,
    [userId, phoneHash]
  );
  return rows.map((r) => ({
    tournament: toTournamentDto(r),
    squad: { id: r.squad_id, name: r.squad_name, slotNumber: r.slot_number, placement: r.placement, kills: r.kills, myRole: r.is_captain ? 'captain' : 'member' },
  }));
}

/**
 * Room ID and password: only for members of a registered squad (or the organizer), and only once
 * the database clock reaches credentials_release_at. Otherwise 403 with the seconds remaining.
 */
export async function getRoomCredentials(user: AuthUser, tournamentId: string) {
  const { rows } = await pool.query<{
    status: TournamentStatus;
    room_id: string | null;
    room_password: string | null;
    credentials_release_at: Date | null;
    seconds_remaining: number | null;
  }>(
    `SELECT status, room_id, room_password, credentials_release_at,
            CASE WHEN credentials_release_at IS NULL THEN NULL
                 ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (credentials_release_at - now()))))::int
            END AS seconds_remaining
       FROM tournaments WHERE id = $1`,
    [tournamentId]
  );
  const t = rows[0];
  if (!t) throw notFound('Tournament');

  const isAdmin = user.role === 'admin';
  if (!isAdmin && !(await findUserSquad(pool, user.id, tournamentId))) {
    throw forbidden('NOT_REGISTERED', 'Register a squad to get the room details.');
  }
  if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
    throw forbidden('TOURNAMENT_CLOSED', `This tournament is ${t.status.toLowerCase()}.`);
  }
  const released = t.credentials_release_at !== null && t.seconds_remaining === 0;
  if (!isAdmin && (!released || !t.room_id || !t.room_password)) {
    throw forbidden('CREDENTIALS_NOT_RELEASED', 'Room details are not available yet.', {
      secondsRemaining: t.seconds_remaining,
      releaseAt: t.credentials_release_at,
    });
  }
  if (!t.room_id || !t.room_password) throw notFound('Room details');
  return { roomId: t.room_id, roomPassword: decryptSecret(t.room_password, env.ROOM_CREDENTIALS_KEY), releasedAt: t.credentials_release_at };
}

// =============================================================================================
// Organizer (admin)
// =============================================================================================

/** Full registration list with every member's name, number and UID. Admin only. */
export async function listRegistrations(tournamentId: string) {
  const { rows: tournaments } = await pool.query<TournamentRow>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  if (!tournaments[0]) throw notFound('Tournament');
  const { rows: squads } = await pool.query<SquadRow & { captain_name: string | null }>(
    `SELECT s.*, u.display_name AS captain_name
       FROM squads s JOIN users u ON u.id = s.captain_id
      WHERE s.tournament_id = $1
      ORDER BY s.slot_number`,
    [tournamentId]
  );
  const members = await loadMembers(pool, squads.map((s) => s.id));
  return {
    tournament: toTournamentDto(tournaments[0]),
    squads: squads.map((s) => ({ ...toSquadDto(s, members.get(s.id) ?? [], 'admin'), captainAccountName: s.captain_name })),
  };
}

export async function removeSquad(adminId: string, tournamentId: string, squadId: string, reason: string) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED') throw conflict('TOURNAMENT_CLOSED', 'Results are already posted.');
    const { rows } = await client.query<{ name: string }>(
      'DELETE FROM squads WHERE id = $1 AND tournament_id = $2 RETURNING name',
      [squadId, t.id]
    );
    if (!rows[0]) throw notFound('Squad');
    await client.query('UPDATE tournaments SET filled_slots = filled_slots - $2 WHERE id = $1', [t.id, TEAM_SIZE[t.mode]]);
    await recordAdminAction(client, {
      adminId,
      action: 'SQUAD_REMOVED',
      targetType: 'tournament',
      targetId: t.id,
      details: { squadName: rows[0].name, reason },
    });
    return { removed: true };
  });
}

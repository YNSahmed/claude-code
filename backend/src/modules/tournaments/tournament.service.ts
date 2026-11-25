import { pool, withTransaction, type DbClient } from '../../config/db.js';
import { env } from '../../config/env.js';
import { recordAdminAction } from '../../utils/audit.js';
import { encryptSecret } from '../../utils/crypto.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import {
  TEAM_SIZE,
  type CreateTournamentInput,
  type Mode,
  type ResultsInput,
  type RoomCredentialsInput,
  type TournamentStatus,
} from './tournament.schema.js';

export interface TournamentRow {
  id: string;
  title: string;
  mode: Mode;
  map: string;
  entry_fee: number;
  prize_pool: number;
  prize_split_bps: number[];
  per_kill_reward: number;
  max_slots: number;
  filled_slots: number;
  starts_at: Date;
  room_id: string | null;
  room_password: string | null;
  credentials_release_at: Date | null;
  status: TournamentStatus;
  rules: string[];
  settled_at: Date | null;
}

/** Public view of a tournament. Never contains room credentials or anyone's personal data. */
export function toTournamentDto(t: TournamentRow) {
  const teamSize = TEAM_SIZE[t.mode];
  const maxTeams = t.max_slots / teamSize;
  const teamsRegistered = t.filled_slots / teamSize;
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    teamSize,
    map: t.map,
    entryFee: t.entry_fee,
    prizePool: t.prize_pool,
    prizeSplitBps: t.prize_split_bps,
    prizes: t.prize_split_bps.map((bps) => Math.floor((t.prize_pool * bps) / 10_000)),
    perKillReward: t.per_kill_reward,
    maxTeams,
    teamsRegistered,
    teamsLeft: maxTeams - teamsRegistered,
    startsAt: t.starts_at,
    status: t.status,
    rules: t.rules,
    roomPublished: t.room_id !== null,
    credentialsReleaseAt: t.credentials_release_at,
  };
}

export async function lockTournament(client: DbClient, tournamentId: string) {
  const { rows } = await client.query<TournamentRow & { started: boolean; registration_closed: boolean }>(
    `SELECT *,
            starts_at <= now() AS started,
            now() >= starts_at - make_interval(mins => $2) AS registration_closed
       FROM tournaments
      WHERE id = $1
        FOR UPDATE`,
    [tournamentId, env.REGISTRATION_CLOSE_MINUTES]
  );
  if (!rows[0]) throw notFound('Tournament');
  return rows[0];
}

// =============================================================================================
// Browsing (public)
// =============================================================================================

export async function listTournaments(query: { status?: TournamentStatus | undefined; limit: number }) {
  const { rows } = await pool.query<TournamentRow>(
    `SELECT * FROM tournaments
      WHERE ($1::text IS NULL AND status IN ('OPEN', 'LOCKED', 'LIVE')) OR status = $1
      ORDER BY CASE WHEN status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END,
               CASE WHEN status IN ('COMPLETED', 'CANCELLED') THEN NULL ELSE starts_at END ASC,
               starts_at DESC
      LIMIT $2`,
    [query.status ?? null, query.limit]
  );
  return rows.map(toTournamentDto);
}

/** The tournament plus the names of registered squads. No members, no phone numbers. */
export async function getTournament(tournamentId: string) {
  const { rows } = await pool.query<TournamentRow>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  if (!rows[0]) throw notFound('Tournament');
  const { rows: squads } = await pool.query<{ name: string; slot_number: number }>(
    'SELECT name, slot_number FROM squads WHERE tournament_id = $1 ORDER BY slot_number',
    [tournamentId]
  );
  return {
    tournament: toTournamentDto(rows[0]),
    squads: squads.map((s) => ({ name: s.name, slotNumber: s.slot_number })),
  };
}

/** Final standings: squad names, placement, kills and prize. Public once results are posted. */
export async function getLeaderboard(tournamentId: string) {
  const { rows } = await pool.query<TournamentRow>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  const t = rows[0];
  if (!t) throw notFound('Tournament');
  if (t.status !== 'COMPLETED') return { tournament: toTournamentDto(t), standings: [] };

  const { rows: squads } = await pool.query<{ id: string; name: string; placement: number; kills: number }>(
    `SELECT id, name, placement, kills FROM squads WHERE tournament_id = $1 AND placement IS NOT NULL ORDER BY placement`,
    [tournamentId]
  );
  const prizes = toTournamentDto(t).prizes;
  return {
    tournament: toTournamentDto(t),
    standings: squads.map((s) => ({
      squadId: s.id,
      squadName: s.name,
      placement: s.placement,
      kills: s.kills,
      prize: (prizes[s.placement - 1] ?? 0) + s.kills * t.per_kill_reward,
    })),
  };
}

// =============================================================================================
// Organizer (admin)
// =============================================================================================

export async function createTournament(adminId: string, input: CreateTournamentInput) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<TournamentRow>(
      `INSERT INTO tournaments
         (title, mode, map, entry_fee, prize_pool, prize_split_bps, per_kill_reward, max_slots, starts_at, rules, created_by)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.title,
        input.mode,
        input.map,
        input.prizePool,
        input.prizeSplitBps,
        input.perKillReward,
        input.maxTeams * TEAM_SIZE[input.mode],
        input.startsAt,
        input.rules,
        adminId,
      ]
    );
    const tournament = rows[0] as TournamentRow;
    await recordAdminAction(client, {
      adminId,
      action: 'TOURNAMENT_CREATED',
      targetType: 'tournament',
      targetId: tournament.id,
      details: { title: input.title, mode: input.mode, maxTeams: input.maxTeams },
    });
    return toTournamentDto(tournament);
  });
}

export async function setRoomCredentials(adminId: string, tournamentId: string, input: RoomCredentialsInput) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
      throw conflict('TOURNAMENT_CLOSED', `This tournament is already ${t.status.toLowerCase()}.`);
    }
    if (input.releaseAt > t.starts_at) {
      throw badRequest('INVALID_RELEASE_TIME', 'Room details must be released at or before the start time.');
    }
    const { rows } = await client.query<TournamentRow>(
      `UPDATE tournaments SET room_id = $2, room_password = $3, credentials_release_at = $4 WHERE id = $1 RETURNING *`,
      [t.id, input.roomId, encryptSecret(input.roomPassword, env.ROOM_CREDENTIALS_KEY), input.releaseAt]
    );
    await recordAdminAction(client, {
      adminId,
      action: 'ROOM_CREDENTIALS_SET',
      targetType: 'tournament',
      targetId: t.id,
      details: { roomId: input.roomId, releaseAt: input.releaseAt.toISOString() },
    });
    return toTournamentDto(rows[0] as TournamentRow);
  });
}

const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  OPEN: ['LOCKED', 'LIVE'],
  LOCKED: ['LIVE'],
  LIVE: [],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateTournamentStatus(adminId: string, tournamentId: string, status: 'LOCKED' | 'LIVE') {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (!ALLOWED_TRANSITIONS[t.status].includes(status)) {
      throw conflict('INVALID_STATUS_CHANGE', `A ${t.status} tournament cannot become ${status}.`);
    }
    const { rows } = await client.query<TournamentRow>('UPDATE tournaments SET status = $2 WHERE id = $1 RETURNING *', [t.id, status]);
    await recordAdminAction(client, {
      adminId,
      action: 'TOURNAMENT_STATUS_CHANGED',
      targetType: 'tournament',
      targetId: t.id,
      details: { from: t.status, to: status },
    });
    return toTournamentDto(rows[0] as TournamentRow);
  });
}

/**
 * Records the final standings. The organizer gives each squad a placement and its kills; the
 * results are checked (every squad once, placements 1..N with no gaps, kills ≤ players − 1).
 * Prize amounts shown on the leaderboard are computed from the tournament's prize settings.
 */
export async function publishResults(adminId: string, tournamentId: string, input: ResultsInput) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED') throw conflict('ALREADY_SETTLED', 'Results for this tournament are already posted.');
    if (t.status === 'CANCELLED') throw conflict('TOURNAMENT_CANCELLED', 'This tournament was cancelled.');
    if (!t.started) throw conflict('NOT_STARTED', 'Results can only be posted after the tournament starts.');

    const { rows: squads } = await client.query<{ id: string }>(
      'SELECT id FROM squads WHERE tournament_id = $1 ORDER BY slot_number FOR UPDATE',
      [t.id]
    );
    const ids = new Set(squads.map((s) => s.id));
    const seen = new Set<string>();
    for (const r of input.results) {
      if (!ids.has(r.squadId)) throw badRequest('UNKNOWN_SQUAD', `${r.squadId} is not registered in this tournament.`);
      if (seen.has(r.squadId)) throw badRequest('DUPLICATE_RESULT', 'Each squad can only appear once.');
      seen.add(r.squadId);
    }
    if (seen.size !== ids.size) {
      throw badRequest('RESULTS_INCOMPLETE', 'Give a result for every registered squad.', { expected: ids.size, received: seen.size });
    }
    const placements = input.results.map((r) => r.placement);
    if (new Set(placements).size !== placements.length || placements.some((p) => p > placements.length)) {
      throw badRequest('INVALID_PLACEMENTS', `Give each squad a different placement from 1 to ${placements.length}.`);
    }
    const players = ids.size * TEAM_SIZE[t.mode];
    const totalKills = input.results.reduce((sum, r) => sum + r.kills, 0);
    if (totalKills > players - 1) throw badRequest('TOO_MANY_KILLS', `Total kills (${totalKills}) cannot exceed ${players - 1}.`);

    await client.query(
      `UPDATE squads AS s SET placement = r.placement, kills = r.kills
         FROM unnest($1::uuid[], $2::int[], $3::int[]) AS r(id, placement, kills)
        WHERE s.id = r.id`,
      [input.results.map((r) => r.squadId), input.results.map((r) => r.placement), input.results.map((r) => r.kills)]
    );
    await client.query(`UPDATE tournaments SET status = 'COMPLETED', settled_at = now() WHERE id = $1`, [t.id]);
    await recordAdminAction(client, {
      adminId,
      action: 'RESULTS_PUBLISHED',
      targetType: 'tournament',
      targetId: t.id,
      details: { results: input.results },
    });
    return { tournamentId: t.id, published: input.results.length };
  });
}

export async function cancelTournament(adminId: string, tournamentId: string, reason: string) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
      throw conflict('TOURNAMENT_CLOSED', `This tournament is already ${t.status.toLowerCase()}.`);
    }
    await client.query(`UPDATE tournaments SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`, [t.id]);
    await recordAdminAction(client, { adminId, action: 'TOURNAMENT_CANCELLED', targetType: 'tournament', targetId: t.id, details: { reason } });
    return { tournamentId: t.id, cancelled: true };
  });
}

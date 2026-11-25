import { pool, withTransaction, type DbClient } from '../../config/db.js';
import { env } from '../../config/env.js';
import type { Role } from '../../middlewares/auth.js';
import { recordAdminAction } from '../../utils/audit.js';
import { decryptSecret, encryptSecret } from '../../utils/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { getBalance, lockWallet, postLedger, type Movement } from '../wallet/wallet.service.js';
import {
  TEAM_SIZE,
  type CreateTournamentInput,
  type Mode,
  type RoomCredentialsInput,
  type SettleInput,
  type TournamentStatus,
} from './tournament.schema.js';

interface TournamentRow {
  id: string;
  title: string;
  mode: Mode;
  map: string;
  entry_fee: number;
  bonus_cap: number;
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
  settled_at: Date | null;
}

interface ParticipantRow {
  id: string;
  user_id: string;
  slot_number: number;
  paid_bonus: number;
  paid_deposit: number;
  paid_winning: number;
}

/** Public view of a tournament. Room credentials are never included here. */
function toTournamentDto(t: TournamentRow) {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    teamSize: TEAM_SIZE[t.mode],
    map: t.map,
    entryFee: t.entry_fee,
    bonusCap: t.bonus_cap,
    prizePool: t.prize_pool,
    prizeSplitBps: t.prize_split_bps,
    perKillReward: t.per_kill_reward,
    maxSlots: t.max_slots,
    filledSlots: t.filled_slots,
    slotsLeft: t.max_slots - t.filled_slots,
    startsAt: t.starts_at,
    status: t.status,
    roomPublished: t.room_id !== null,
    credentialsReleaseAt: t.credentials_release_at,
  };
}

async function lockTournament(client: DbClient, tournamentId: string) {
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
// Browsing
// =============================================================================================

export async function listTournaments(query: { status?: TournamentStatus | undefined; limit: number }) {
  const { rows } = await pool.query<TournamentRow>(
    `SELECT * FROM tournaments
      WHERE ($1::text IS NULL AND status IN ('OPEN', 'LOCKED', 'LIVE')) OR status = $1
      ORDER BY starts_at ASC
      LIMIT $2`,
    [query.status ?? null, query.limit]
  );
  return rows.map(toTournamentDto);
}

export async function getTournament(tournamentId: string) {
  const { rows } = await pool.query<TournamentRow>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  if (!rows[0]) throw notFound('Tournament');
  return toTournamentDto(rows[0]);
}

export async function listMyEntries(userId: string) {
  const { rows } = await pool.query<TournamentRow & { participant_id: string; slot_number: number; entry_status: string; placement: number | null; kills: number | null; prize_amount: number | null }>(
    `SELECT t.*, p.id AS participant_id, p.slot_number, p.status AS entry_status, p.placement, p.kills, p.prize_amount
       FROM tournament_participants p
       JOIN tournaments t ON t.id = p.tournament_id
      WHERE p.user_id = $1
      ORDER BY t.starts_at DESC
      LIMIT 100`,
    [userId]
  );
  return rows.map((r) => ({
    tournament: toTournamentDto(r),
    entry: {
      participantId: r.participant_id,
      slotNumber: r.slot_number,
      teamNumber: Math.ceil(r.slot_number / TEAM_SIZE[r.mode]),
      status: r.entry_status,
      placement: r.placement,
      kills: r.kills,
      prize: r.prize_amount,
    },
  }));
}

// =============================================================================================
// Admin setup
// =============================================================================================

export async function createTournament(adminId: string, input: CreateTournamentInput) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<TournamentRow>(
      `INSERT INTO tournaments
         (title, mode, map, entry_fee, bonus_cap, prize_pool, prize_split_bps, per_kill_reward, max_slots, starts_at,
          room_id, room_password, credentials_release_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.title,
        input.mode,
        input.map,
        input.entryFee,
        input.bonusCap,
        input.prizePool,
        input.prizeSplitBps,
        input.perKillReward,
        input.maxSlots,
        input.startsAt,
        input.room?.roomId ?? null,
        input.room ? encryptSecret(input.room.roomPassword, env.ROOM_CREDENTIALS_KEY) : null,
        input.room?.releaseAt ?? null,
        adminId,
      ]
    );
    const tournament = rows[0] as TournamentRow;
    await recordAdminAction(client, {
      adminId,
      action: 'TOURNAMENT_CREATED',
      targetType: 'tournament',
      targetId: tournament.id,
      details: { title: input.title, entryFee: input.entryFee, prizePool: input.prizePool, maxSlots: input.maxSlots },
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
    const { rows } = await client.query<TournamentRow>('UPDATE tournaments SET status = $2 WHERE id = $1 RETURNING *', [
      t.id,
      status,
    ]);
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

// =============================================================================================
// Joining
// =============================================================================================

/**
 * Books a slot and charges the entry fee, all in one transaction:
 *  1. Lock the tournament row (FOR UPDATE), so concurrent joins queue up and slots cannot oversell.
 *  2. Check it is OPEN, registration has not closed, and a slot is free.
 *  3. Check the player has a verified Free Fire UID. The user row is held FOR SHARE so the UID
 *     cannot change mid-join (the UID change endpoint takes FOR UPDATE).
 *  4. Lock the wallet (FOR UPDATE) and split the fee: bonus up to the tournament's cap, then
 *     deposit, then winnings (only if ALLOW_WINNINGS_FOR_ENTRY).
 *  5. Insert the participant (unique per user, slot and UID), write the ledger, bump filled_slots.
 * The entry fee always comes from the tournament row, never from the client.
 */
export async function joinTournament(userId: string, tournamentId: string) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status !== 'OPEN' || t.registration_closed) {
      throw conflict('REGISTRATION_CLOSED', 'Registration for this tournament is closed.');
    }
    if (t.filled_slots >= t.max_slots) throw conflict('TOURNAMENT_FULL', 'All slots are taken.');

    const { rows: users } = await client.query<{ free_fire_uid: string | null; free_fire_uid_verified_at: Date | null }>(
      'SELECT free_fire_uid, free_fire_uid_verified_at FROM users WHERE id = $1 FOR SHARE',
      [userId]
    );
    const user = users[0];
    if (!user) throw notFound('User');
    if (!user.free_fire_uid || !user.free_fire_uid_verified_at) {
      throw forbidden('UID_NOT_VERIFIED', 'Add your Free Fire UID and wait for it to be verified before joining.');
    }

    const { rowCount: alreadyJoined } = await client.query(
      'SELECT 1 FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
      [t.id, userId]
    );
    if (alreadyJoined) throw conflict('ALREADY_JOINED', 'You have already joined this tournament.');

    const wallet = await lockWallet(client, userId);
    const fee = t.entry_fee;
    const fromBonus = Math.min(wallet.bonus_balance, t.bonus_cap, fee);
    let remaining = fee - fromBonus;
    const fromDeposit = Math.min(wallet.deposit_balance, remaining);
    remaining -= fromDeposit;
    const fromWinning = env.ALLOW_WINNINGS_FOR_ENTRY ? Math.min(wallet.winning_balance, remaining) : 0;
    remaining -= fromWinning;
    if (remaining > 0) {
      throw conflict('INSUFFICIENT_BALANCE', 'Not enough balance to pay the entry fee.', { entryFee: fee, shortBy: remaining });
    }

    const slotNumber = t.filled_slots + 1;
    const { rows: inserted } = await client.query<{ id: string }>(
      `INSERT INTO tournament_participants
         (tournament_id, user_id, slot_number, free_fire_uid, paid_bonus, paid_deposit, paid_winning)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [t.id, userId, slotNumber, user.free_fire_uid, fromBonus, fromDeposit, fromWinning]
    );
    const participantId = (inserted[0] as { id: string }).id;

    await postLedger(client, {
      referenceType: 'TOURNAMENT_ENTRY',
      referenceId: participantId,
      reason: `Entry fee: ${t.title}`,
      movements: [
        { userId, account: 'BONUS', amount: -fromBonus },
        { userId, account: 'DEPOSIT', amount: -fromDeposit },
        { userId, account: 'WINNING', amount: -fromWinning },
        { account: 'SYS_TOURNAMENT_POOL', amount: fee },
      ],
    });

    await client.query('UPDATE tournaments SET filled_slots = filled_slots + 1 WHERE id = $1', [t.id]);

    return {
      participantId,
      tournamentId: t.id,
      slotNumber,
      teamNumber: Math.ceil(slotNumber / TEAM_SIZE[t.mode]),
      paid: { bonus: fromBonus, deposit: fromDeposit, winning: fromWinning, total: fee },
      balance: await getBalance(userId, client),
    };
  });
}

// =============================================================================================
// Room credentials
// =============================================================================================

/**
 * Returns the room ID and password only to a confirmed participant (or an admin), and only once
 * the database clock has reached credentials_release_at. Otherwise 403 with the seconds left.
 */
export async function getRoomCredentials(user: { id: string; role: Role }, tournamentId: string) {
  const { rows } = await pool.query<{
    status: TournamentStatus;
    room_id: string | null;
    room_password: string | null;
    credentials_release_at: Date | null;
    seconds_remaining: number | null;
    is_participant: boolean;
  }>(
    `SELECT t.status, t.room_id, t.room_password, t.credentials_release_at,
            CASE WHEN t.credentials_release_at IS NULL THEN NULL
                 ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (t.credentials_release_at - now()))))::int
            END AS seconds_remaining,
            EXISTS (
              SELECT 1 FROM tournament_participants p
               WHERE p.tournament_id = t.id AND p.user_id = $2 AND p.status = 'CONFIRMED'
            ) AS is_participant
       FROM tournaments t
      WHERE t.id = $1`,
    [tournamentId, user.id]
  );
  const t = rows[0];
  if (!t) throw notFound('Tournament');

  const isAdmin = user.role === 'admin';
  if (!isAdmin && !t.is_participant) {
    throw forbidden('NOT_A_PARTICIPANT', 'Join this tournament to get the room details.');
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

  return {
    roomId: t.room_id,
    roomPassword: decryptSecret(t.room_password, env.ROOM_CREDENTIALS_KEY),
    releasedAt: t.credentials_release_at,
  };
}

// =============================================================================================
// Settlement and cancellation
// =============================================================================================

async function lockConfirmedParticipants(client: DbClient, tournamentId: string): Promise<ParticipantRow[]> {
  const { rows } = await client.query<ParticipantRow>(
    `SELECT id, user_id, slot_number, paid_bonus, paid_deposit, paid_winning
       FROM tournament_participants
      WHERE tournament_id = $1 AND status = 'CONFIRMED'
      ORDER BY slot_number
        FOR UPDATE`,
    [tournamentId]
  );
  return rows;
}

/**
 * Pays out a finished match. The admin only reports placements and kills; every amount is
 * computed here from the tournament row:
 *  - placement p wins prize_pool × prizeSplitBps[p−1] / 10000, shared equally by that team
 *    (any indivisible remainder goes to the team's lowest slot)
 *  - plus per_kill_reward × kills for each player
 * Results are checked for consistency: one per participant, teammates share a placement,
 * placements are 1..number of teams, and total kills cannot exceed players − 1.
 */
export async function settleTournament(adminId: string, tournamentId: string, input: SettleInput) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED') throw conflict('ALREADY_SETTLED', 'This tournament has already been settled.');
    if (t.status === 'CANCELLED') throw conflict('TOURNAMENT_CANCELLED', 'This tournament was cancelled.');
    if (!t.started) throw conflict('NOT_STARTED', 'A tournament can only be settled after it starts.');

    const participants = await lockConfirmedParticipants(client, t.id);
    const byId = new Map(participants.map((p) => [p.id, p]));
    if (input.results.length !== participants.length) {
      throw badRequest('RESULTS_INCOMPLETE', 'Send exactly one result for every confirmed participant.', {
        expected: participants.length,
        received: input.results.length,
      });
    }

    const teamSize = TEAM_SIZE[t.mode];
    const teamPlacement = new Map<number, number>();
    const seen = new Set<string>();
    for (const result of input.results) {
      const participant = byId.get(result.participantId);
      if (!participant) throw badRequest('UNKNOWN_PARTICIPANT', `${result.participantId} is not in this tournament.`);
      if (seen.has(result.participantId)) throw badRequest('DUPLICATE_RESULT', `${result.participantId} appears twice.`);
      seen.add(result.participantId);

      const team = Math.ceil(participant.slot_number / teamSize);
      const known = teamPlacement.get(team);
      if (known !== undefined && known !== result.placement) {
        throw badRequest('TEAM_PLACEMENT_MISMATCH', `Players of team ${team} must share one placement.`);
      }
      teamPlacement.set(team, result.placement);
    }

    const placements = [...teamPlacement.values()];
    if (new Set(placements).size !== placements.length || placements.some((p) => p > placements.length)) {
      throw badRequest('INVALID_PLACEMENTS', `Give each team a different placement from 1 to ${placements.length}.`);
    }
    const totalKills = input.results.reduce((sum, r) => sum + r.kills, 0);
    if (totalKills > participants.length - 1) {
      throw badRequest('TOO_MANY_KILLS', `Total kills (${totalKills}) cannot exceed ${participants.length - 1}.`);
    }

    // Prize per placement, split across the team.
    const prizes = new Map<string, number>(input.results.map((r) => [r.participantId, r.kills * t.per_kill_reward]));
    t.prize_split_bps.forEach((bps, index) => {
      const winners = input.results
        .filter((r) => r.placement === index + 1)
        .sort((a, b) => (byId.get(a.participantId)?.slot_number ?? 0) - (byId.get(b.participantId)?.slot_number ?? 0));
      if (winners.length === 0) return;
      const amount = Math.floor((t.prize_pool * bps) / 10_000);
      const share = Math.floor(amount / winners.length);
      winners.forEach((winner, i) => {
        const extra = i === 0 ? amount - share * winners.length : 0;
        prizes.set(winner.participantId, (prizes.get(winner.participantId) ?? 0) + share + extra);
      });
    });

    const payouts = input.results.map((r) => {
      const participant = byId.get(r.participantId) as ParticipantRow;
      return { participantId: r.participantId, userId: participant.user_id, placement: r.placement, kills: r.kills, prize: prizes.get(r.participantId) ?? 0 };
    });
    const totalPaid = payouts.reduce((sum, p) => sum + p.prize, 0);

    const movements: Movement[] = payouts.map((p) => ({ userId: p.userId, account: 'WINNING', amount: p.prize }));
    movements.push({ account: 'SYS_TOURNAMENT_POOL', amount: -totalPaid });
    await postLedger(client, {
      referenceType: 'TOURNAMENT_PRIZE',
      referenceId: t.id,
      reason: `Prizes: ${t.title}`,
      movements,
    });

    await client.query(
      `UPDATE tournament_participants AS p
          SET placement = r.placement, kills = r.kills, prize_amount = r.prize
         FROM unnest($1::uuid[], $2::int[], $3::int[], $4::bigint[]) AS r(id, placement, kills, prize)
        WHERE p.id = r.id`,
      [payouts.map((p) => p.participantId), payouts.map((p) => p.placement), payouts.map((p) => p.kills), payouts.map((p) => p.prize)]
    );
    await client.query(`UPDATE tournaments SET status = 'COMPLETED', settled_at = now() WHERE id = $1`, [t.id]);
    await recordAdminAction(client, {
      adminId,
      action: 'TOURNAMENT_SETTLED',
      targetType: 'tournament',
      targetId: t.id,
      details: { totalPaid, results: input.results },
    });

    return { tournamentId: t.id, totalPaid, payouts: payouts.sort((a, b) => a.placement - b.placement) };
  });
}

/** Cancels a tournament and refunds every entry fee to exactly the balances it was paid from. */
export async function cancelTournament(adminId: string, tournamentId: string, reason: string) {
  return withTransaction(async (client) => {
    const t = await lockTournament(client, tournamentId);
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') {
      throw conflict('TOURNAMENT_CLOSED', `This tournament is already ${t.status.toLowerCase()}.`);
    }

    const participants = await lockConfirmedParticipants(client, t.id);
    const movements: Movement[] = participants.flatMap((p) => [
      { userId: p.user_id, account: 'BONUS' as const, amount: p.paid_bonus },
      { userId: p.user_id, account: 'DEPOSIT' as const, amount: p.paid_deposit },
      { userId: p.user_id, account: 'WINNING' as const, amount: p.paid_winning },
    ]);
    const totalRefunded = participants.reduce((sum, p) => sum + p.paid_bonus + p.paid_deposit + p.paid_winning, 0);
    movements.push({ account: 'SYS_TOURNAMENT_POOL', amount: -totalRefunded });

    await postLedger(client, {
      referenceType: 'TOURNAMENT_REFUND',
      referenceId: t.id,
      reason: `Refund: ${t.title} cancelled`,
      movements,
    });
    await client.query(
      `UPDATE tournament_participants SET status = 'REFUNDED' WHERE tournament_id = $1 AND status = 'CONFIRMED'`,
      [t.id]
    );
    await client.query(`UPDATE tournaments SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`, [t.id]);
    await recordAdminAction(client, {
      adminId,
      action: 'TOURNAMENT_CANCELLED',
      targetType: 'tournament',
      targetId: t.id,
      details: { reason, refunded: participants.length, totalRefunded },
    });

    return { tournamentId: t.id, refundedParticipants: participants.length, totalRefunded };
  });
}

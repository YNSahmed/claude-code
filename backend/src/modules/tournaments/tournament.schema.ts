import { z } from 'zod';

export const MODES = ['SOLO', 'DUO', 'SQUAD'] as const;
export const MAPS = ['BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA'] as const;
export const STATUSES = ['OPEN', 'LOCKED', 'LIVE', 'COMPLETED', 'CANCELLED'] as const;

export type Mode = (typeof MODES)[number];
export type TournamentStatus = (typeof STATUSES)[number];

/** Players per team. Teams are consecutive slots: in DUO, slots 1–2 are team 1, 3–4 team 2, and so on. */
export const TEAM_SIZE: Record<Mode, number> = { SOLO: 1, DUO: 2, SQUAD: 4 };

const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const tournamentIdParams = z.object({ id: z.uuid() });

export const listTournamentsQuery = z.object({
  status: z.enum(STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const roomCredentialsSchema = z.strictObject({
  roomId: z.string().trim().regex(/^[0-9A-Za-z]{4,20}$/, 'Room IDs are 4–20 letters or digits.'),
  roomPassword: z.string().trim().min(1).max(32),
  /** When participants may see the credentials. Must be at or before the start time. */
  releaseAt: isoDateTime,
});

export const createTournamentSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(80),
    mode: z.enum(MODES),
    map: z.enum(MAPS),
    entryFee: z.number().int().min(0).max(100_000),
    bonusCap: z.number().int().min(0).default(0),
    prizePool: z.number().int().min(0).max(10_000_000),
    prizeSplitBps: z
      .array(z.number().int().min(0).max(10_000))
      .min(1)
      .max(10)
      .refine((split) => split.reduce((a, b) => a + b, 0) <= 10_000, 'The prize split cannot exceed 100% (10000 bps).')
      .default([5000, 3000, 2000]),
    perKillReward: z.number().int().min(0).max(100_000).default(0),
    maxSlots: z.number().int().min(2).max(48),
    startsAt: isoDateTime,
    room: roomCredentialsSchema.optional(),
  })
  .refine((t) => t.bonusCap <= t.entryFee, { message: 'bonusCap cannot exceed entryFee.', path: ['bonusCap'] })
  .refine((t) => t.maxSlots % TEAM_SIZE[t.mode] === 0, {
    message: 'maxSlots must be a multiple of the team size.',
    path: ['maxSlots'],
  })
  .refine((t) => t.startsAt.getTime() > Date.now(), { message: 'startsAt must be in the future.', path: ['startsAt'] })
  .refine((t) => !t.room || t.room.releaseAt <= t.startsAt, {
    message: 'Room details must be released at or before the start time.',
    path: ['room', 'releaseAt'],
  });

export const updateStatusSchema = z.strictObject({
  /** OPEN → LOCKED closes registration; LOCKED/OPEN → LIVE marks the match as being played. */
  status: z.enum(['LOCKED', 'LIVE']),
});

export const settleSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        participantId: z.uuid(),
        placement: z.number().int().min(1).max(48),
        kills: z.number().int().min(0).max(47),
      })
    )
    .min(1)
    .max(48),
});

export const cancelSchema = z.strictObject({
  reason: z.string().trim().min(3).max(200),
});

export type CreateTournamentInput = z.output<typeof createTournamentSchema>;
export type RoomCredentialsInput = z.output<typeof roomCredentialsSchema>;
export type SettleInput = z.output<typeof settleSchema>;

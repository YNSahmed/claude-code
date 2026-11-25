import { z } from 'zod';

import { indianMobileSchema } from '../../utils/pii.js';

export const MODES = ['SOLO', 'DUO', 'SQUAD'] as const;
export const MAPS = ['BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA'] as const;
export const STATUSES = ['OPEN', 'LOCKED', 'LIVE', 'COMPLETED', 'CANCELLED'] as const;

export type Mode = (typeof MODES)[number];
export type TournamentStatus = (typeof STATUSES)[number];

/** Players per team. A battle-royale custom room holds 48 players. */
export const TEAM_SIZE: Record<Mode, number> = { SOLO: 1, DUO: 2, SQUAD: 4 };
export const ROOM_CAPACITY = 48;

const isoDateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const freeFireUid = z
  .string()
  .trim()
  .regex(/^[0-9]{6,12}$/, 'Free Fire UIDs are 6–12 digits.')
  .optional()
  .or(z.literal('').transform(() => undefined));
const personName = z.string().trim().min(2, 'Enter a name (2+ letters).').max(32);

export const tournamentIdParams = z.object({ id: z.uuid() });
export const squadParams = z.object({ id: z.uuid(), squadId: z.uuid() });

export const listTournamentsQuery = z.object({
  status: z.enum(STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const roomCredentialsSchema = z.strictObject({
  roomId: z.string().trim().regex(/^[0-9A-Za-z]{4,20}$/, 'Room IDs are 4–20 letters or digits.'),
  roomPassword: z.string().trim().min(1).max(32),
  /** When registered players may see the credentials. Must be at or before the start time. */
  releaseAt: isoDateTime,
});

export const createTournamentSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(80),
    mode: z.enum(MODES).default('SQUAD'),
    map: z.enum(MAPS),
    prizePool: z.number().int().min(0).max(10_000_000).default(0),
    prizeSplitBps: z
      .array(z.number().int().min(0).max(10_000))
      .min(1)
      .max(10)
      .refine((split) => split.reduce((a, b) => a + b, 0) <= 10_000, 'The prize split cannot exceed 100% (10000 bps).')
      .default([5000, 3000, 2000]),
    perKillReward: z.number().int().min(0).max(100_000).default(0),
    /** Number of teams (squads for SQUAD mode). */
    maxTeams: z.number().int().min(2).max(ROOM_CAPACITY),
    startsAt: isoDateTime,
    rules: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  })
  .refine((t) => t.maxTeams * TEAM_SIZE[t.mode] <= ROOM_CAPACITY, {
    message: `A room holds ${ROOM_CAPACITY} players.`,
    path: ['maxTeams'],
  })
  .refine((t) => t.startsAt.getTime() > Date.now(), { message: 'startsAt must be in the future.', path: ['startsAt'] });

export const updateStatusSchema = z.strictObject({
  /** OPEN → LOCKED closes registration; LOCKED/OPEN → LIVE marks the match as being played. */
  status: z.enum(['LOCKED', 'LIVE']),
});

export const resultsSchema = z.strictObject({
  results: z
    .array(
      z.strictObject({
        squadId: z.uuid(),
        placement: z.number().int().min(1).max(ROOM_CAPACITY),
        kills: z.number().int().min(0).max(ROOM_CAPACITY - 1),
      })
    )
    .min(1)
    .max(ROOM_CAPACITY),
});

export const cancelSchema = z.strictObject({
  reason: z.string().trim().min(3).max(200),
});

export const registerSquadSchema = z.strictObject({
  squadName: z.string().trim().min(2, 'Give your squad a name.').max(24),
  /** The signed-in player. Their phone number is the verified one from their account. */
  captain: z.strictObject({ name: personName, freeFireUid }),
  /** Everyone else in the team: 3 for a squad, 1 for a duo, none for solo. */
  teammates: z.array(z.strictObject({ name: personName, phone: indianMobileSchema, freeFireUid })).max(3),
  /** The captain confirms their teammates agreed to share their name and number with the organizer. */
  consent: z.literal(true, 'Confirm your teammates agreed to share their details.'),
});

export const removeSquadSchema = z.strictObject({
  reason: z.string().trim().min(3).max(200),
});

export type CreateTournamentInput = z.output<typeof createTournamentSchema>;
export type RoomCredentialsInput = z.output<typeof roomCredentialsSchema>;
export type ResultsInput = z.output<typeof resultsSchema>;
export type RegisterSquadInput = z.output<typeof registerSquadSchema>;

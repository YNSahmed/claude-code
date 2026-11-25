import { DEFAULT_RULES, TEAM_SIZE } from '@/constants/config';

import type { GameMap, Mode, Registration, Result, Tournament, TournamentStatus } from './types';

/**
 * Sample tournaments shown on first launch, so the app has something to browse.
 * They are hosted by a demo organizer; tournaments you create are hosted by you.
 */

export const DEMO_HOST = { id: 'host-clutch-arena', name: 'Clutch Arena Official' } as const;

const NAME_PARTS = {
  first: [
    'Shadow',
    'Ninja',
    'Blaze',
    'Silent',
    'Rush',
    'Vortex',
    'Alpha',
    'Storm',
    'Phantom',
    'Dragon',
    'Toxic',
    'Ghost',
    'Viper',
    'Reaper',
    'Titan',
    'Sky',
    'Dark',
    'Iron',
    'Cobra',
    'Night',
    'Frost',
    'Nova',
    'Rogue',
    'Hydra',
  ],
  last: ['X', 'King', 'OP', 'FF', 'God', 'Pro', 'Ace', 'YT', '007', 'Boss', 'Hunter', 'Wolf'],
};

const TEAM_NAMES = [
  'Team Inferno',
  'Red Devils',
  'Headshot Hunters',
  'Night Owls',
  'Rush Squad',
  'Zero Mercy',
  'Elite Force',
  'Dead Aim',
  'Wolf Pack',
  'Storm Riders',
  'Iron Legion',
  'Silent Assassins',
  'Neon Ninjas',
  'Fire Hawks',
  'Last Circle',
  'Drop Zone',
  'Ghost Unit',
  'Hot Drop',
  'Final Zone',
  'Clutch Kings',
  'Rapid Fire',
  'Blue Zone',
  'Air Drop',
  'Top Fraggers',
];

/** Small deterministic random generator, so sample data looks the same on every device. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function makeRegistrations(
  tournamentId: string,
  mode: Mode,
  count: number,
  seed: number,
  startsAt: number
): Registration[] {
  const rand = random(seed);
  const size = TEAM_SIZE[mode];
  return Array.from({ length: count }, (_, team) => {
    const players = Array.from({ length: size }, (_, member) => {
      const index = team * size + member + seed;
      const first = NAME_PARTS.first[index % NAME_PARTS.first.length];
      const last = NAME_PARTS.last[Math.floor(rand() * NAME_PARTS.last.length)];
      return {
        ign: `${first}${last}`,
        uid: String(1_000_000_000 + Math.floor(rand() * 8_999_999_999)),
      };
    });
    return {
      id: `${tournamentId}-team-${team + 1}`,
      userId: `demo-user-${seed}-${team}`,
      teamName: size === 1 ? players[0].ign : TEAM_NAMES[(team + seed) % TEAM_NAMES.length],
      players,
      joinedAt: new Date(startsAt - (count - team) * 600_000 - 86_400_000).toISOString(),
    };
  });
}

function makeResults(registrations: Registration[], seed: number): Result[] {
  const rand = random(seed);
  const order = [...registrations].sort(() => rand() - 0.5);
  return order.map((r, i) => ({
    registrationId: r.id,
    placement: i + 1,
    kills: Math.max(0, Math.round((registrations.length - i) / 3 + rand() * 4 - 1)),
  }));
}

/** The next quarter hour at least `minutes` from now. */
function inMinutes(now: number, minutes: number): number {
  const quarter = 15 * 60_000;
  return Math.ceil((now + minutes * 60_000) / quarter) * quarter;
}

/** `days` from today at the given local hour. */
function onDay(now: number, days: number, hour: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

interface SeedSpec {
  id: string;
  title: string;
  mode: Mode;
  map: GameMap;
  startsAt: number;
  maxTeams: number;
  teams: number;
  entryFee: number;
  prizePool: number;
  perKill: number;
  status: TournamentStatus;
  room?: { id: string; password: string };
}

export function createSeedTournaments(now: number): Tournament[] {
  const specs: SeedSpec[] = [
    {
      id: 'seed-solo-sniper',
      title: 'Solo Sniper Cup',
      mode: 'Solo',
      map: 'Purgatory',
      startsAt: inMinutes(now, 20),
      maxTeams: 48,
      teams: 41,
      entryFee: 10,
      prizePool: 1000,
      perKill: 5,
      status: 'upcoming',
      room: { id: '4829173', password: 'snipe48' },
    },
    {
      id: 'seed-squad-showdown',
      title: 'Squad Showdown',
      mode: 'Squad',
      map: 'Bermuda',
      startsAt: inMinutes(now, 180),
      maxTeams: 12,
      teams: 9,
      entryFee: 50,
      prizePool: 5000,
      perKill: 20,
      status: 'upcoming',
    },
    {
      id: 'seed-duo-rush',
      title: 'Duo Rush Night',
      mode: 'Duo',
      map: 'Kalahari',
      startsAt: onDay(now, 1, 21),
      maxTeams: 24,
      teams: 14,
      entryFee: 0,
      prizePool: 1500,
      perKill: 10,
      status: 'upcoming',
    },
    {
      id: 'seed-mega-league',
      title: 'Weekend Mega League',
      mode: 'Squad',
      map: 'Alpine',
      startsAt: onDay(now, 2, 20),
      maxTeams: 12,
      teams: 4,
      entryFee: 100,
      prizePool: 10000,
      perKill: 25,
      status: 'upcoming',
    },
    {
      id: 'seed-lunch-battle',
      title: 'Lunch Break Battle',
      mode: 'Duo',
      map: 'NeXTerra',
      startsAt: now - 10 * 60_000,
      maxTeams: 24,
      teams: 24,
      entryFee: 20,
      prizePool: 2000,
      perKill: 10,
      status: 'live',
      room: { id: '7731052', password: 'duo24' },
    },
    {
      id: 'seed-midweek-clash',
      title: 'Midweek Clash',
      mode: 'Solo',
      map: 'Bermuda',
      startsAt: onDay(now, -1, 20),
      maxTeams: 48,
      teams: 20,
      entryFee: 0,
      prizePool: 800,
      perKill: 5,
      status: 'completed',
      room: { id: '5510298', password: 'mid20' },
    },
  ];

  return specs.map((spec, index) => {
    const seed = index + 7;
    const registrations = makeRegistrations(spec.id, spec.mode, spec.teams, seed, spec.startsAt);
    return {
      id: spec.id,
      title: spec.title,
      mode: spec.mode,
      map: spec.map,
      startsAt: new Date(spec.startsAt).toISOString(),
      maxTeams: spec.maxTeams,
      entryFee: spec.entryFee,
      prizePool: spec.prizePool,
      perKill: spec.perKill,
      rules: DEFAULT_RULES,
      hostId: DEMO_HOST.id,
      hostName: DEMO_HOST.name,
      status: spec.status,
      room: spec.room
        ? { ...spec.room, publishedAt: new Date(spec.startsAt - 15 * 60_000).toISOString() }
        : null,
      registrations,
      results: spec.status === 'completed' ? makeResults(registrations, seed) : [],
      createdAt: new Date(spec.startsAt - 3 * 86_400_000).toISOString(),
    };
  });
}

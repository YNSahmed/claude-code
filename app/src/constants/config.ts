import type { GameMap, Mode } from '@/api/types';

export const APP_NAME = 'Clutch Arena';

/** The backend URL. Set EXPO_PUBLIC_API_URL in app/.env (see .env.example). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  ''
);

export const CURRENCY_SYMBOL = '₹';

export const MODES: Mode[] = ['SQUAD', 'DUO', 'SOLO'];
export const MAPS: GameMap[] = ['BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA'];

export const MODE_LABEL: Record<Mode, string> = { SOLO: 'Solo', DUO: 'Duo', SQUAD: 'Squad' };
export const MAP_LABEL: Record<GameMap, string> = {
  BERMUDA: 'Bermuda',
  PURGATORY: 'Purgatory',
  KALAHARI: 'Kalahari',
  ALPINE: 'Alpine',
  NEXTERRA: 'NeXTerra',
};

export const TEAM_SIZE: Record<Mode, number> = { SOLO: 1, DUO: 2, SQUAD: 4 };

/** A battle-royale custom room holds 48 players: 12 squads, 24 duos or 48 solo players. */
export const ROOM_CAPACITY = 48;

export const DEFAULT_RULES = [
  'Join the custom room with the names and UIDs you registered.',
  'Room ID and password are shared in the app 10–15 minutes before the start.',
  'No hacks, scripts or teaming with other squads. Cheaters are disqualified.',
  'Take a screenshot of your result screen in case of disputes.',
  "The organizer's decision is final.",
];

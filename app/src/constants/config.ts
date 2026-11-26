import { Platform } from 'react-native';

import type { GameMap, Mode } from '@/api/types';

export const APP_NAME = 'Clutch Arena';

/**
 * The backend URL, from EXPO_PUBLIC_API_URL (see .env.example).
 * - Phone builds need the full address, e.g. https://clutch-arena.onrender.com.
 * - The web build served by the backend itself sets it to "" and calls its own address.
 */
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
export const API_URL = (
  configuredApiUrl !== undefined && (configuredApiUrl !== '' || Platform.OS === 'web')
    ? configuredApiUrl
    : 'http://localhost:4000'
).replace(/\/$/, '');

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

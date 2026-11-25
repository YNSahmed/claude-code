import type { GameMap, Mode } from '@/data/types';

export const APP_NAME = 'Clutch Arena';

/** Shown before every amount. Change it to your local currency, for example '₹', '৳', 'Rp' or 'R$'. */
export const CURRENCY_SYMBOL = '$';

export const MODES: Mode[] = ['Solo', 'Duo', 'Squad'];

export const MAPS: GameMap[] = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NeXTerra'];

export const TEAM_SIZE: Record<Mode, number> = { Solo: 1, Duo: 2, Squad: 4 };

/** A battle-royale custom room holds 48 players: 48 solo players, 24 duos or 12 squads. */
export const MAX_TEAMS: Record<Mode, number> = { Solo: 48, Duo: 24, Squad: 12 };

/** Share of the prize pool for 1st, 2nd and 3rd place. Kills are paid on top. */
export const PRIZE_SPLIT = [0.5, 0.3, 0.2] as const;

export const IGN_LENGTH = { min: 2, max: 20 } as const;

/** In-game player IDs are numeric. */
export const UID_PATTERN = /^\d{6,12}$/;

export const DEFAULT_RULES = [
  'Join the custom room with the IGN and UID you registered.',
  'Room ID and password are shared 10–15 minutes before the start.',
  'No hacks, scripts or teaming with other teams. Cheaters are disqualified.',
  'Take a screenshot of your result screen in case of disputes.',
  "The organizer's decision is final.",
];

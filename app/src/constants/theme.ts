import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { GameMap, Mode, TournamentStatus } from '@/data/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const Colors = {
  background: '#0A0C11',
  surface: '#141720',
  surfaceRaised: '#1C2030',
  border: '#272C3D',
  text: '#F4F6FB',
  textMuted: '#9AA2B6',
  textFaint: '#626B80',
  primary: '#FF6A1A',
  primaryDeep: '#FF2E4D',
  gold: '#FFC23D',
  live: '#22D37A',
  info: '#3DA9FF',
  danger: '#FF4D5E',
  overlay: 'rgba(10, 12, 17, 0.55)',
} as const;

type Gradient = readonly [string, string, ...string[]];

export const Gradients = {
  fire: ['#FF8A00', '#FF2E4D'],
  gold: ['#FFD86B', '#FF9F1C'],
  night: ['#1E2236', '#0A0C11'],
} as const satisfies Record<string, Gradient>;

export const MapStyles: Record<GameMap, { gradient: Gradient; icon: IconName }> = {
  Bermuda: { gradient: ['#13B5A5', '#1B3F8B'], icon: 'earth' },
  Purgatory: { gradient: ['#9B3CF0', '#2A0A4F'], icon: 'flame' },
  Kalahari: { gradient: ['#F7A440', '#8A300B'], icon: 'sunny' },
  Alpine: { gradient: ['#6FC8FF', '#24427A'], icon: 'snow' },
  NeXTerra: { gradient: ['#00E0C6', '#4C1D95'], icon: 'planet' },
};

export const ModeColors: Record<Mode, string> = {
  Solo: '#3DA9FF',
  Duo: '#B47CFF',
  Squad: '#FF8A3D',
};

export const StatusStyles: Record<TournamentStatus, { label: string; color: string }> = {
  upcoming: { label: 'Open', color: Colors.info },
  live: { label: 'Live', color: Colors.live },
  completed: { label: 'Completed', color: Colors.textMuted },
};

/** Loaded in the root layout from @expo-google-fonts/rajdhani. */
export const Fonts = {
  display: 'Rajdhani_700Bold',
  displaySemi: 'Rajdhani_600SemiBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const MaxContentWidth = 640;

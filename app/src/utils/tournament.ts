import type { Tournament } from '@/api/types';
import { APP_NAME, MAP_LABEL, MODE_LABEL } from '@/constants/config';

import { formatCountdown, formatDateTime, formatEntry, formatMoney } from './format';

export function isRegistrationOpen(t: Tournament): boolean {
  return t.status === 'OPEN' && t.teamsLeft > 0 && new Date(t.startsAt).getTime() > Date.now();
}

/** "Starts in 2h 10m", "Live now", or the date. */
export function timeLabel(t: Tournament, now: number): string {
  if (t.status === 'LIVE') return 'Live now';
  if (t.status === 'CANCELLED') return 'Cancelled';
  if (t.status === 'COMPLETED') return formatDateTime(t.startsAt, new Date(now));
  const msLeft = new Date(t.startsAt).getTime() - now;
  if (msLeft <= 0) return 'Starting now';
  if (msLeft < 86_400_000) return `Starts in ${formatCountdown(t.startsAt, now)}`;
  return formatDateTime(t.startsAt, new Date(now));
}

export function teamWord(t: Pick<Tournament, 'mode'>, count = 2): string {
  const word = t.mode === 'SOLO' ? 'player' : t.mode === 'DUO' ? 'duo' : 'squad';
  return count === 1 ? word : `${word}s`;
}

/** Text to post with a poster or share in a group chat. */
export function inviteMessage(t: Tournament, channelUrl?: string | null): string {
  return [
    `🔥 ${t.title.toUpperCase()} 🔥`,
    `🎮 Free Fire ${MODE_LABEL[t.mode]} · ${MAP_LABEL[t.map]}`,
    `📅 ${formatDateTime(t.startsAt)}`,
    `🏆 Prize pool ${formatMoney(t.prizePool)}${t.perKillReward ? ` + ${formatMoney(t.perKillReward)}/kill` : ''}`,
    `🎟️ Entry: ${formatEntry(t.entryFee)} · ${t.teamsLeft} ${teamWord(t, t.teamsLeft)} left`,
    `👉 Register your ${teamWord(t, 1)} in the ${APP_NAME} app`,
    ...(channelUrl ? [`📢 Updates: ${channelUrl}`] : []),
  ].join('\n');
}

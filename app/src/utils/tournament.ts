import { APP_NAME, PRIZE_SPLIT, TEAM_SIZE } from '@/constants/config';
import type { Registration, Result, Tournament } from '@/data/types';

import { formatDateTime, formatEntry, formatMoney } from './format';

export function teamSize(t: Tournament): number {
  return TEAM_SIZE[t.mode];
}

export function slotsLeft(t: Tournament): number {
  return Math.max(0, t.maxTeams - t.registrations.length);
}

export function isFull(t: Tournament): boolean {
  return slotsLeft(t) === 0;
}

export function findRegistration(
  t: Tournament,
  userId: string | undefined
): Registration | undefined {
  if (!userId) return undefined;
  return t.registrations.find((r) => r.userId === userId);
}

export function canJoin(t: Tournament, userId: string | undefined): boolean {
  return (
    t.status === 'upcoming' && !isFull(t) && !findRegistration(t, userId) && t.hostId !== userId
  );
}

export function prizeForPlacement(t: Tournament, placement: number): number {
  return Math.round((PRIZE_SPLIT[placement - 1] ?? 0) * t.prizePool);
}

export function earningsFor(t: Tournament, result: Result): number {
  return prizeForPlacement(t, result.placement) + result.kills * t.perKill;
}

export interface Standing {
  result: Result;
  registration: Registration;
  earnings: number;
}

export function standings(t: Tournament): Standing[] {
  return [...t.results]
    .sort((a, b) => a.placement - b.placement)
    .flatMap((result) => {
      const registration = t.registrations.find((r) => r.id === result.registrationId);
      return registration ? [{ result, registration, earnings: earningsFor(t, result) }] : [];
    });
}

export interface PlayerStats {
  joined: number;
  played: number;
  wins: number;
  kills: number;
  earnings: number;
}

export function playerStats(tournaments: Tournament[], userId: string): PlayerStats {
  const stats: PlayerStats = { joined: 0, played: 0, wins: 0, kills: 0, earnings: 0 };
  for (const t of tournaments) {
    const registration = findRegistration(t, userId);
    if (!registration) continue;
    stats.joined += 1;
    const result = t.results.find((r) => r.registrationId === registration.id);
    if (t.status !== 'completed' || !result) continue;
    stats.played += 1;
    stats.kills += result.kills;
    stats.earnings += earningsFor(t, result);
    if (result.placement === 1) stats.wins += 1;
  }
  return stats;
}

export function byStartTime(a: Tournament, b: Tournament): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

/** Text for sharing a tournament in a group chat. */
export function inviteMessage(t: Tournament): string {
  return [
    `🔥 ${t.title}`,
    `${t.mode} · ${t.map} · ${formatDateTime(t.startsAt)}`,
    `Prize pool ${formatMoney(t.prizePool)} · ${formatMoney(t.perKill)} per kill · Entry ${formatEntry(t.entryFee)}`,
    `${slotsLeft(t)} slots left. Join on ${APP_NAME}!`,
  ].join('\n');
}

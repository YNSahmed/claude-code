import { CURRENCY_SYMBOL } from '@/constants/config';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoney(value: number): string {
  return `${CURRENCY_SYMBOL}${formatNumber(value)}`;
}

export function formatEntry(fee: number): string {
  return fee > 0 ? formatMoney(fee) : 'Free';
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

export function formatDay(date: Date, now: Date = new Date()): string {
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';
  return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDateTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return `${formatDay(date, now)} · ${formatTime(date)}`;
}

/** "45m", "3h 20m", "2d 4h", or "now" once the start time has passed. */
export function formatCountdown(iso: string, now: number): string {
  const minutes = Math.floor((new Date(iso).getTime() - now) / 60_000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function initials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}]/gu, '');
  return (clean.slice(0, 2) || '?').toUpperCase();
}

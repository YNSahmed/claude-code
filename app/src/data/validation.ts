import { IGN_LENGTH, UID_PATTERN } from '@/constants/config';

export function validateIgn(ign: string): string | null {
  const value = ign.trim();
  if (!value) return 'Enter your in-game name';
  if (value.length < IGN_LENGTH.min || value.length > IGN_LENGTH.max) {
    return `Use ${IGN_LENGTH.min}–${IGN_LENGTH.max} characters`;
  }
  return null;
}

export function validateUid(uid: string): string | null {
  const value = uid.trim();
  if (!value) return 'Enter the player ID';
  if (!UID_PATTERN.test(value)) return 'Player IDs are 6–12 digits';
  return null;
}

/** Keeps only digits, for numeric inputs. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

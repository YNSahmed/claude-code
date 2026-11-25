import { z } from 'zod';

import { env } from '../config/env.js';
import { decryptSecret, deriveKey, encryptSecret, keyedHash } from './crypto.js';

/**
 * Personal data helpers. Phone numbers of squad members are stored encrypted, compared by a keyed
 * hash, and only ever returned in full to the organizer and the squad's own captain.
 */

const encryptionKeyHex = deriveKey(env.PII_ENCRYPTION_KEY, 'pii-encryption-v1').toString('hex');
const phoneHashKey = deriveKey(env.PII_ENCRYPTION_KEY, 'phone-hash-v1');
export const otpHashKey = deriveKey(env.PII_ENCRYPTION_KEY, 'otp-hash-v1');

export const encryptPii = (value: string) => encryptSecret(value, encryptionKeyHex);
export const decryptPii = (value: string) => decryptSecret(value, encryptionKeyHex);
export const hashPhone = (phone: string) => keyedHash(phoneHashKey, phone);

/** Accepts "9876543210", "+91 98765 43210", "919876543210"; returns "+919876543210" or null. */
export function normalizeIndianMobile(input: string): string | null {
  const match = input.replace(/[\s()-]/g, '').match(/^(?:\+?91|0)?([6-9][0-9]{9})$/);
  return match ? `+91${match[1]}` : null;
}

/** "+919876543210" → "+91 98•••••210" */
export function maskPhone(phone: string): string {
  const digits = phone.slice(3);
  return `+91 ${digits.slice(0, 2)}•••••${digits.slice(-3)}`;
}

export const indianMobileSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeIndianMobile(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit Indian mobile number.' });
      return z.NEVER;
    }
    return phone;
  });

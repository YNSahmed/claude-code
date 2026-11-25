import {
  createCipheriv,
  hkdfSync,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
  type BinaryLike,
} from 'node:crypto';

/**
 * Verifies a payment gateway webhook: HMAC-SHA256 of the exact raw request bytes, hex encoded
 * (Razorpay's X-Razorpay-Signature format). Compared in constant time.
 *
 * Always verify the raw body, never a re-serialized JSON object: re-serializing can change the
 * bytes and lets an attacker smuggle in fields the signature never covered.
 */
export function verifyHmacSha256Signature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Signs a payload the same way the gateway does. Used by tests and local tooling. */
export function signHmacSha256(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function sha256Hex(data: BinaryLike): string {
  return createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------------------------
// AES-256-GCM for secrets stored in the database (room passwords).
// Format: "v1:" + base64(iv[12] | authTag[16] | ciphertext).
// ---------------------------------------------------------------------------------------------

const CIPHER_VERSION = 'v1';

export function encryptSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${CIPHER_VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
}

export function decryptSecret(token: string, keyHex: string): string {
  const [version, payload] = token.split(':');
  if (version !== CIPHER_VERSION || !payload) throw new Error('Unsupported secret format');
  const data = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------------------------
// Personal data: separate keys for each purpose, all derived from PII_ENCRYPTION_KEY with HKDF.
// ---------------------------------------------------------------------------------------------

export function deriveKey(masterKeyHex: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(masterKeyHex, 'hex'), Buffer.alloc(0), purpose, 32));
}

/** Keyed HMAC-SHA256, hex. Used to look up or compare private values without storing them in clear. */
export function keyedHash(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

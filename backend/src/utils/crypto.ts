import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
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
// Password hashing with scrypt (memory-hard; built into Node, no native dependency).
// Format: "scrypt$N$r$p$salt$hash" so parameters can be raised later without breaking old hashes.
// ---------------------------------------------------------------------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 } as const;

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => (error ? reject(error) : resolve(derived)));
  });
}

function scryptOptions(N: number, r: number, p: number): ScryptOptions {
  return { N, r, p, maxmem: 256 * N * r };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT.keyLength, scryptOptions(SCRYPT.N, SCRYPT.r, SCRYPT.p));
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, scryptOptions(+n, +r, +p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A real hash of a random password. Checking against it keeps "unknown phone" as slow as "wrong password". */
export const DUMMY_PASSWORD_HASH = await hashPassword(randomBytes(16).toString('hex'));

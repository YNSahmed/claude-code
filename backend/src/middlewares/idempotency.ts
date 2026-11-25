import type { NextFunction, Request, Response } from 'express';

import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { sha256Hex } from '../utils/crypto.js';
import { AppError, badRequest, conflict } from '../utils/errors.js';

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;
/** How long an IN_PROGRESS claim blocks retries before another attempt may take it over. */
const LOCK_SECONDS = 60;

interface IdempotencyOptions {
  /** Stable name of the operation, e.g. "POST /wallet/withdraw". */
  scope: string;
  /** Headers to read the key from, first match wins. Defaults to Idempotency-Key. */
  keyHeaders?: string[];
  /** Who owns the key namespace. Defaults to the signed-in user. */
  owner?: (req: Request) => string;
}

interface StoredKey {
  scope: string;
  request_hash: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  response_status: number | null;
  response_body: unknown;
}

/**
 * Makes a money-moving endpoint safe to retry.
 *
 * 1. Atomically claims (owner, key) with INSERT ... ON CONFLICT DO NOTHING.
 * 2. A repeat of a completed request gets the stored response replayed (Idempotent-Replayed: true),
 *    without running the handler again.
 * 3. A repeat while the first is still running gets 409; the same key with a different body gets 422.
 * 4. The response is saved before it is sent. 5xx responses release the key so the client may retry.
 *
 * Services add a second layer (unique constraints, row status checks inside the transaction), so
 * even a crash between the business commit and saving the response cannot double-charge.
 */
export function idempotency(options: IdempotencyOptions) {
  const headers = options.keyHeaders ?? ['Idempotency-Key'];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = headers.map((h) => req.get(h)).find((value) => value !== undefined);
    if (!key) throw badRequest('IDEMPOTENCY_KEY_REQUIRED', `Send a unique ${headers[0]} header with this request.`);
    if (!KEY_PATTERN.test(key)) {
      throw badRequest('IDEMPOTENCY_KEY_INVALID', `${headers[0]} must be 8–128 letters, digits, "-", "_", ":" or ".".`);
    }

    const owner = options.owner ? options.owner(req) : `user:${req.user?.id ?? 'anonymous'}`;
    const requestHash = sha256Hex(`${req.method}\n${req.originalUrl.split('?')[0]}\n${req.rawBody?.toString('base64') ?? ''}`);

    const claimed = await pool.query(
      `INSERT INTO idempotency_keys (owner, key, scope, request_hash, status, locked_until)
       VALUES ($1, $2, $3, $4, 'IN_PROGRESS', now() + make_interval(secs => $5))
       ON CONFLICT (owner, key) DO NOTHING`,
      [owner, key, options.scope, requestHash, LOCK_SECONDS]
    );

    if (claimed.rowCount === 0) {
      const { rows } = await pool.query<StoredKey>(
        `SELECT scope, request_hash, status, response_status, response_body
           FROM idempotency_keys WHERE owner = $1 AND key = $2`,
        [owner, key]
      );
      const existing = rows[0];
      if (!existing) throw conflict('IDEMPOTENCY_RETRY', 'Please retry the request.');

      if (existing.scope !== options.scope || existing.request_hash !== requestHash) {
        throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.');
      }

      if (existing.status === 'COMPLETED' && existing.response_status !== null) {
        res.set('Idempotent-Replayed', 'true');
        res.status(existing.response_status).json(existing.response_body);
        return;
      }

      // Still IN_PROGRESS. Only take it over if the original attempt's lock has expired
      // (for example the process crashed mid-request).
      const takeover = await pool.query(
        `UPDATE idempotency_keys
            SET locked_until = now() + make_interval(secs => $3)
          WHERE owner = $1 AND key = $2 AND status = 'IN_PROGRESS' AND locked_until < now()`,
        [owner, key, LOCK_SECONDS]
      );
      if (takeover.rowCount === 0) {
        throw conflict('REQUEST_IN_PROGRESS', 'This request is already being processed. Wait a moment and retry.');
      }
    }

    // Save the outcome before the response leaves the server.
    const sendJson = res.json.bind(res);
    let saved = false;
    res.json = (body: unknown) => {
      if (saved) return sendJson(body);
      saved = true;
      const status = res.statusCode;
      const persist =
        status >= 500
          ? pool.query('DELETE FROM idempotency_keys WHERE owner = $1 AND key = $2', [owner, key])
          : pool.query(
              `UPDATE idempotency_keys
                  SET status = 'COMPLETED', response_status = $3, response_body = $4, locked_until = NULL
                WHERE owner = $1 AND key = $2`,
              [owner, key, status, JSON.stringify(body ?? null)]
            );
      persist
        .catch((error: unknown) => {
          logger.error('Could not save idempotent response', {
            scope: options.scope,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => sendJson(body));
      return res;
    };

    next();
  };
}

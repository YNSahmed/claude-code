import pg from 'pg';

import { logger } from '../utils/logger.js';
import { env } from './env.js';

// BIGINT (int8) columns hold token amounts. Return them as numbers, and fail loudly instead of
// silently losing precision if a value ever exceeds Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`int8 value ${value} is outside the safe integer range`);
  return parsed;
});

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
  application_name: 'ff-arena-api',
  // Server-side safety limits for every session:
  //  - statement_timeout: no query runs longer than 10s
  //  - lock_timeout: waiting on a row lock fails after 5s instead of piling up requests
  //  - idle_in_transaction_session_timeout: a stuck transaction cannot hold locks forever
  options: '-c statement_timeout=10000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000',
});

pool.on('error', (error) => {
  logger.error('Idle database client error', { error: error.message });
});

export type DbClient = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  /** Extra attempts after a serialization failure or deadlock. */
  retries?: number;
}

/** SQLSTATEs that mean "nothing was committed, it is safe to run the whole transaction again". */
const RETRYABLE_CODES = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

function isRetryable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && RETRYABLE_CODES.has((error as { code?: string }).code ?? '');
}

/**
 * Runs `work` inside one PostgreSQL transaction (BEGIN ... COMMIT, or ROLLBACK on any error).
 *
 * Every financial change goes through here. Callers lock the rows they change with
 * SELECT ... FOR UPDATE. Deadlocks and serialization failures roll back and retry
 * automatically, which is safe because nothing outside the database happens inside `work`.
 */
export async function withTransaction<T>(work: (client: DbClient) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
  const { isolationLevel = 'READ COMMITTED', retries = 2 } = options;

  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    let releaseWithError: Error | undefined;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // The connection is broken; destroy it instead of returning it to the pool.
        releaseWithError = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      }
      if (isRetryable(error) && attempt < retries) {
        logger.warn('Retrying transaction', { attempt: attempt + 1, code: (error as { code?: string }).code });
        await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt + Math.random() * 30));
        continue;
      }
      throw error;
    } finally {
      client.release(releaseWithError);
    }
  }
}

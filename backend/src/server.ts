import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('API listening', { port: env.PORT, env: env.NODE_ENV, sms: env.SMS_PROVIDER, wallet: env.WALLET_ENABLED });
});

// Housekeeping: completed idempotency keys only need to outlive retries, and old login codes
// (even hashed) are kept no longer than needed for abuse checks.
const cleanup = setInterval(() => {
  Promise.all([
    pool.query(`DELETE FROM idempotency_keys WHERE status = 'COMPLETED' AND created_at < now() - interval '7 days'`),
    pool.query(`DELETE FROM otp_challenges WHERE created_at < now() - interval '1 day'`),
  ]).catch((error: unknown) => logger.warn('Cleanup failed', { error: String(error) }));
}, 60 * 60_000);
cleanup.unref();

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down', { signal });
  // Stop accepting connections, let in-flight requests (and their transactions) finish, then close the pool.
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.message : String(reason) });
});

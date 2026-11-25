import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import express, { type Express, type Request } from 'express';
import helmet from 'helmet';

import { pool } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { authRouter, usersRouter } from './modules/auth/auth.routes.js';
import { tournamentRouter } from './modules/tournaments/tournament.routes.js';
import { walletRouter } from './modules/wallet/wallet.routes.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Needed behind a load balancer so req.ip (used by rate limits) is the real client IP.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    // API responses (balances, room passwords) must never be cached by proxies or the client.
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(helmet());

  // Parse JSON, keeping the exact bytes for webhook signature checks and idempotency hashing.
  app.use(
    express.json({
      limit: '64kb',
      strict: true,
      verify: (req: IncomingMessage, _res, buffer: Buffer) => {
        (req as Request).rawBody = Buffer.from(buffer);
      },
    })
  );

  app.use(globalLimiter);

  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/wallet', walletRouter);
  app.use('/api/v1/tournaments', tournamentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

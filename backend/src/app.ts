import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';

import cors from 'cors';
import express, { type Express, type Request } from 'express';
import helmet from 'helmet';

import { pool } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { globalLimiter } from './middlewares/rateLimiter.js';
import { authRouter, usersRouter } from './modules/auth/auth.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
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
    // API responses (room passwords, personal data) must never be cached by proxies or the client.
    if (req.path.startsWith('/api/') || req.path === '/health') res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(helmet());
  // Only the listed browser origins (the web build) may call the API; mobile apps are unaffected.
  app.use(cors({ origin: env.CORS_ORIGINS, allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'], maxAge: 600 }));

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
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/tournaments', tournamentRouter);
  // The token wallet stays switched off unless WALLET_ENABLED=true (registration is free).
  if (env.WALLET_ENABLED) app.use('/api/v1/wallet', walletRouter);

  // The web version of the app (an Expo web export), served from the same address as the API.
  const webDir = env.WEB_APP_DIR ? path.resolve(process.cwd(), env.WEB_APP_DIR) : null;
  if (webDir && existsSync(path.join(webDir, 'index.html'))) {
    app.use(
      express.static(webDir, {
        index: false,
        setHeaders: (res, filePath) => {
          // File names under _expo/static contain a content hash, so they can be cached for a year.
          res.set('Cache-Control', filePath.includes(`${path.sep}_expo${path.sep}static${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      })
    );
    // Every other page (/, /tournament/..., /legal/privacy) is handled by the app's own router.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

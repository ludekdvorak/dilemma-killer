import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { optionalAuth } from './auth.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './errors.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter, wheelRouter } from './routes/games.js';
import { playersRouter } from './routes/players.js';
import { statisticsRouter } from './routes/statistics.js';

export function createApp() {
  const app = express();
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const clientDirectory = path.resolve(moduleDirectory, '../dist');
  const clientIndex = path.join(clientDirectory, 'index.html');

  if (config.isProduction && !existsSync(clientIndex)) {
    throw new Error(`Production frontend is missing at ${clientIndex}. Run the build before starting.`);
  }

  app.disable('x-powered-by');
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
  }));

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/wheel/health', (_request, response) => {
    response.type('text/plain').send('Dilemma Killer API is running!');
  });

  app.get('/api/config', (_request, response) => {
    response.json({ mockUpgradeEnabled: config.allowMockUpgrade });
  });

  app.get('/api/ready', async (_request, response) => {
    await pool.query('SELECT 1');
    response.json({ status: 'ready' });
  });

  app.use('/api', optionalAuth);

  app.use('/api/auth', authRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/wheel', wheelRouter);
  app.use('/api/statistics', statisticsRouter);
  app.use('/api', notFound);

  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory, {
      index: false,
      setHeaders(response, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.use((request, response, next) => {
      if (request.method === 'GET' && request.accepts('html')) {
        response.setHeader('Cache-Control', 'no-cache');
        response.sendFile(path.join(clientDirectory, 'index.html'));
        return;
      }
      next();
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

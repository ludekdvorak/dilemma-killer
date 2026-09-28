import '../runtime-env.js';
import type { Handler, HandlerResponse } from '@netlify/functions';
import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config.js';
import { runMigrations } from '../../server/db/migrations.js';
import { needsDatabaseInitialization } from '../database-gate.js';

const expressHandler = serverless(createApp({ serveFrontend: false }));
let migrationsPromise: Promise<void> | undefined;

async function ensureDatabaseIsReady(): Promise<void> {
  if (!config.runMigrationsOnStart) return;

  migrationsPromise ??= runMigrations().catch((error: unknown) => {
    migrationsPromise = undefined;
    throw error;
  });
  await migrationsPromise;
}

export const handler: Handler = async (event, context) => {
  // Keep PostgreSQL connections available when Netlify reuses this function instance.
  context.callbackWaitsForEmptyEventLoop = false;
  const cookie = event.headers.cookie ?? event.headers.Cookie ?? '';
  const hasSession = cookie.split(';').some((part) => part.trim().startsWith(`${config.authCookieName}=`));
  const path = event.path.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
  if (needsDatabaseInitialization(event.httpMethod, path, hasSession)) await ensureDatabaseIsReady();
  return expressHandler(event, context) as Promise<HandlerResponse>;
};

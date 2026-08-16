import '../runtime-env.js';
import type { Handler, HandlerResponse } from '@netlify/functions';
import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';
import { config } from '../../server/config.js';
import { runMigrations } from '../../server/db/migrations.js';

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
  await ensureDatabaseIsReady();
  return expressHandler(event, context) as Promise<HandlerResponse>;
};

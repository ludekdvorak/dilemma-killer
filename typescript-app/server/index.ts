import { createApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrations.js';
import { pool } from './db/pool.js';

if (config.runMigrationsOnStart) {
  await runMigrations();
}

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.info(`Dilemma Killer is running at http://${config.host}:${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`${signal} received; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

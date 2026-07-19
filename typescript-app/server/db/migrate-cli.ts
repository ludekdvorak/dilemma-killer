import { runMigrations } from './migrations.js';
import { pool } from './pool.js';

try {
  await runMigrations();
  console.info('Database is up to date.');
} finally {
  await pool.end();
}

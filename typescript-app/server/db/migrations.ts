import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './pool.js';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name VARCHAR(30) NOT NULL,
        premium BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT users_email_normalized CHECK (email = LOWER(BTRIM(email))),
        CONSTRAINT users_display_name_not_blank CHECK (LENGTH(BTRIM(display_name)) > 0)
      );

      CREATE TABLE saved_players (
        id BIGSERIAL PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT saved_players_name_not_blank CHECK (LENGTH(BTRIM(name)) > 0)
      );

      CREATE INDEX saved_players_owner_created_idx
        ON saved_players(owner_id, created_at ASC);
      CREATE UNIQUE INDEX saved_players_owner_name_unique_idx
        ON saved_players(owner_id, LOWER(name));

      CREATE TABLE game_plays (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id VARCHAR(20) NOT NULL,
        player_count SMALLINT NOT NULL,
        played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT game_plays_known_game CHECK (game_id IN ('wheel', 'dice', 'cards')),
        CONSTRAINT game_plays_valid_player_count CHECK (player_count BETWEEN 2 AND 50)
      );

      CREATE INDEX game_plays_user_played_idx
        ON game_plays(user_id, played_at DESC);
      CREATE INDEX game_plays_user_game_idx
        ON game_plays(user_id, game_id);
    `,
  },
];

const migrationLockId = 1_947_260_314;

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    await ensureMigrationTable(client);

    const result = await client.query<{ version: number; checksum: string | null }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const appliedVersions = new Set<number>();

    for (const applied of result.rows) {
      const migration = migrations.find(({ version }) => version === applied.version);
      if (!migration) {
        throw new Error(`Database migration ${applied.version} is newer than this application.`);
      }
      const expectedChecksum = checksum(migration.sql);
      if (applied.checksum && applied.checksum !== expectedChecksum) {
        throw new Error(`Database migration ${applied.version} was modified after it was applied.`);
      }
      if (!applied.checksum) {
        await client.query(
          'UPDATE schema_migrations SET checksum = $1 WHERE version = $2',
          [expectedChecksum, applied.version],
        );
      }
      appliedVersions.add(applied.version);
    }

    await client.query('ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL');

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, checksum(migration.sql)],
        );
        await client.query('COMMIT');
        console.info(`Applied database migration ${migration.version}: ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]).catch(() => undefined);
    client.release();
  }
}

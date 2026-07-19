import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;

// IDs and aggregate counts in this application remain far below Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (value) => Number(value));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
  query_timeout: config.databaseQueryTimeoutMs,
  statement_timeout: config.databaseQueryTimeoutMs,
  ssl: config.databaseSsl
    ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
    : undefined,
  application_name: 'dilemma-killer-typescript',
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

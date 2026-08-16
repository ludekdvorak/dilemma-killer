import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;
const isServerlessRuntime = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

// IDs and aggregate counts in this application remain far below Number.MAX_SAFE_INTEGER.
types.setTypeParser(20, (value) => Number(value));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  // Each serverless instance owns its own pool, so keep the per-instance footprint small.
  max: isServerlessRuntime ? Math.min(config.databasePoolSize, 2) : config.databasePoolSize,
  allowExitOnIdle: isServerlessRuntime,
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

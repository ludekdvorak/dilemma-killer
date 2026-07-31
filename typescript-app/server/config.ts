import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(15_000),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRATION_SECONDS: z.coerce.number().int().min(300).default(604_800),
  ALLOW_MOCK_UPGRADE: z.enum(['true', 'false']).optional(),
  RUN_MIGRATIONS_ON_START: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  APP_BASE_URL: z.string().url().optional(),
  GOPAY_GOID: z.string().min(1).optional(),
  GOPAY_CLIENT_ID: z.string().min(1).optional(),
  GOPAY_CLIENT_SECRET: z.string().min(1).optional(),
  GOPAY_GATEWAY_URL: z.string().url().default('https://gw.sandbox.gopay.com/api'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(parsed.error)}`);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === 'production';
const localDatabaseUrl = 'postgresql://dilemma:dilemma@localhost:5433/dilemma_killer_ts';
const developmentSecret = 'development-only-secret-change-before-production-32-bytes';
const databaseUrl = env.DATABASE_URL ?? (isProduction ? '' : localDatabaseUrl);
const jwtSecret = env.JWT_SECRET ?? (isProduction ? '' : developmentSecret);
const goPayConfigured = Boolean(
  env.APP_BASE_URL
  && env.GOPAY_GOID
  && env.GOPAY_CLIENT_ID
  && env.GOPAY_CLIENT_SECRET,
);

if (!databaseUrl || (isProduction && databaseUrl === localDatabaseUrl)) {
  throw new Error('A non-development DATABASE_URL is required in production.');
}

if (
  jwtSecret.length < 32
  || (isProduction && (
    jwtSecret === developmentSecret
    || jwtSecret.startsWith('replace-with-')
    || jwtSecret.startsWith('<')
    || jwtSecret.includes('random-secret')
  ))
) {
  throw new Error('JWT_SECRET must be a non-placeholder secret containing at least 32 characters.');
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction,
  port: env.PORT,
  host: env.HOST,
  databaseUrl,
  databasePoolSize: env.DATABASE_POOL_SIZE,
  databaseSsl: env.DATABASE_SSL,
  databaseSslRejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
  databaseConnectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS,
  databaseQueryTimeoutMs: env.DATABASE_QUERY_TIMEOUT_MS,
  jwtSecret,
  jwtExpirationSeconds: env.JWT_EXPIRATION_SECONDS,
  allowMockUpgrade: !isProduction && (
    env.ALLOW_MOCK_UPGRADE === undefined || env.ALLOW_MOCK_UPGRADE === 'true'
  ),
  runMigrationsOnStart: env.RUN_MIGRATIONS_ON_START,
  trustProxyHops: env.TRUST_PROXY_HOPS,
  authCookieName: 'dilemma_killer_session',
  appBaseUrl: env.APP_BASE_URL,
  goPay: {
    configured: goPayConfigured,
    goId: env.GOPAY_GOID,
    clientId: env.GOPAY_CLIENT_ID,
    clientSecret: env.GOPAY_CLIENT_SECRET,
    gatewayUrl: env.GOPAY_GATEWAY_URL.replace(/\/$/, ''),
    premiumAmountMinor: 200,
    premiumCurrency: 'EUR',
  },
} as const;

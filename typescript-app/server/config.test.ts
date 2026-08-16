import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('environment configuration', () => {
  it('treats empty optional Netlify build variables as unset', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('ALLOW_MOCK_UPGRADE', '');
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('GOPAY_GOID', '');
    vi.stubEnv('GOPAY_CLIENT_ID', '');
    vi.stubEnv('GOPAY_CLIENT_SECRET', '');

    const { config } = await import('./config.js');

    expect(config.databaseUrl).toBe('postgresql://dilemma:dilemma@localhost:5433/dilemma_killer_ts');
    expect(config.jwtSecret).toHaveLength(57);
    expect(config.allowMockUpgrade).toBe(true);
    expect(config.appBaseUrl).toBeUndefined();
    expect(config.goPay.configured).toBe(false);
  });
});

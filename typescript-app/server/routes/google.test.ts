import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn<(text: string, values?: unknown[]) => Promise<{ rows: object[] }>>());
vi.mock('../db/pool.js', () => ({ pool: { query } }));
vi.mock('../services/google.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/google.js')>(),
  verifyGoogleCredential: vi.fn(),
}));
vi.mock('../config.js', async (importOriginal) => {
  const { config } = await importOriginal<typeof import('../config.js')>();
  return { config: { ...config, googleClientId: 'test.apps.googleusercontent.com' } };
});

import { createApp } from '../app.js';
import { verifyGoogleCredential } from '../services/google.js';

const app = createApp({ serveFrontend: false });
const row = {
  id: 42, email: 'alice@gmail.com', password_hash: null, display_name: 'Alice',
  premium: false, premium_expires_at: null, created_at: new Date(),
};
const identity = vi.mocked(verifyGoogleCredential);
function rows(values: object[]) { return { rows: values, rowCount: values.length, command: '', oid: 0, fields: [] }; }

beforeEach(() => {
  vi.resetAllMocks();
  identity.mockResolvedValue({ subject: 'google-123', email: row.email, displayName: 'Alice' });
});

describe('Google account routes', () => {
  it('provides a fresh, non-cacheable challenge without querying the database', async () => {
    const response = await request(app).get('/api/auth/google/config').expect(200);
    expect(response.body).toMatchObject({ clientId: 'test.apps.googleusercontent.com', nonce: expect.any(String) });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(query).not.toHaveBeenCalled();
  });

  it('automatically registers a new Google user and creates the normal session', async () => {
    query.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([row]));
    const response = await request(app).post('/api/auth/google').send({ credential: 'verified-token' }).expect(200);
    expect(response.body).toMatchObject({ email: row.email, displayName: 'Alice', hasPassword: false });
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/^dilemma_killer_session=.*HttpOnly/)]));
    expect(query.mock.calls[1][1]).toEqual([row.email, 'Alice', 'google-123']);
    expect(response.body).not.toHaveProperty('password_hash');
    expect(response.body).not.toHaveProperty('token');
  });

  it('returns the existing Google account without changing its name or membership', async () => {
    query.mockResolvedValueOnce(rows([{ ...row, premium: true, display_name: 'My saved name' }]));
    const response = await request(app).post('/api/auth/google').send({ credential: 'verified-token' }).expect(200);
    expect(response.body).toMatchObject({ premium: true, displayName: 'My saved name' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not link a password account based only on a matching email', async () => {
    query.mockResolvedValueOnce(rows([])).mockRejectedValueOnce({ code: '23505' });
    const response = await request(app).post('/api/auth/google').send({ credential: 'verified-token' }).expect(409);
    expect(response.body.message).toContain('Sign in with your password');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects an invalid credential without accessing accounts', async () => {
    const { HttpError } = await import('../errors.js');
    identity.mockRejectedValueOnce(new HttpError(401, 'Invalid Google identity'));
    await request(app).post('/api/auth/google').send({ credential: 'invalid' }).expect(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('handles password login to a Google-only account without a server error', async () => {
    query.mockResolvedValueOnce(rows([row]));
    await request(app).post('/api/auth/login').send({ email: row.email, password: 'test-password' }).expect(401);
  });
});

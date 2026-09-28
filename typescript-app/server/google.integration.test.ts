import request from 'supertest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const keyResolver = vi.hoisted(() => vi.fn());
vi.mock('jose', async (importOriginal) => ({
  ...await importOriginal<typeof import('jose')>(), createRemoteJWKSet: () => keyResolver,
}));
vi.mock('./config.js', async (importOriginal) => {
  const { config } = await importOriginal<typeof import('./config.js')>();
  return { config: { ...config, googleClientId: 'integration.apps.googleusercontent.com' } };
});

import { createApp } from './app.js';
import { runMigrations } from './db/migrations.js';
import { pool } from './db/pool.js';

const unique = `google-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `${unique}@gmail.com`;
const passwordEmail = `${unique}-password@gmail.com`;
const app = createApp({ serveFrontend: false });
const user = request.agent(app);
let privateKey: CryptoKey;

beforeAll(async () => {
  await runMigrations();
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  keyResolver.mockImplementation(createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'integration' }] }));
});
afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1::TEXT[])', [[email, passwordEmail]]);
  await pool.end();
});

async function credential(agent: typeof user, identityEmail = email, subject = unique) {
  const config = await agent.get('/api/auth/google/config').expect(200);
  return new SignJWT({ email: identityEmail, email_verified: true, name: 'Google Player', nonce: config.body.nonce })
    .setSubject(subject).setIssuer('https://accounts.google.com').setAudience('integration.apps.googleusercontent.com')
    .setIssuedAt().setExpirationTime('5m').setProtectedHeader({ alg: 'RS256', kid: 'integration' }).sign(privateKey);
}

describe('Google accounts with PostgreSQL', () => {
  it('creates a Google account and can authenticate it using the session cookie', async () => {
    const token = await credential(user);
    const response = await user.post('/api/auth/google').send({ credential: token }).expect(200);
    expect(response.body).toMatchObject({ email, displayName: 'Google Player', hasPassword: false });
    await user.get('/api/auth/me').expect(200, response.body);
    const saved = await pool.query('SELECT password_hash, google_subject FROM users WHERE email = $1', [email]);
    expect(saved.rows).toEqual([{ password_hash: null, google_subject: unique }]);
    await user.post('/api/players').send({ name: 'Saved friend' }).expect(201);
  });

  it('keeps the same account and saved data on subsequent Google sign-in', async () => {
    await user.patch('/api/auth/profile').send({ email, displayName: 'My chosen name' }).expect(200);
    await user.post('/api/auth/logout').expect(204);
    const token = await credential(user);
    const response = await user.post('/api/auth/google').send({ credential: token }).expect(200);
    expect(response.body.displayName).toBe('My chosen name');
    const players = await user.get('/api/players').expect(200);
    expect(players.body).toHaveLength(1);
    expect(players.body[0].name).toBe('Saved friend');
  });

  it('protects Google-managed email and password fields', async () => {
    await user.patch('/api/auth/profile').send({ email: 'other@example.com', displayName: 'My name' }).expect(400);
    await user.post('/api/auth/password').send({ currentPassword: 'anything', newPassword: 'new-password-value' }).expect(400);
    await request(app).post('/api/auth/login').send({ email, password: 'anything' }).expect(401);
  });

  it('does not merge an existing password account by email', async () => {
    const passwordUser = request.agent(app);
    await passwordUser.post('/api/auth/register').send({ email: passwordEmail, displayName: 'Password user', password: 'integration-password' }).expect(201);
    const googleUser = request.agent(app);
    const token = await credential(googleUser, passwordEmail, `${unique}-other`);
    await googleUser.post('/api/auth/google').send({ credential: token }).expect(409);
    const existing = await pool.query('SELECT google_subject FROM users WHERE email = $1', [passwordEmail]);
    expect(existing.rows[0].google_subject).toBeNull();
  });

  it('consumes the sign-in challenge so a credential cannot be replayed', async () => {
    const token = await credential(user);
    await user.post('/api/auth/google').send({ credential: token }).expect(200);
    await user.post('/api/auth/google').send({ credential: token }).expect(401);
  });
});

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { runMigrations } from './db/migrations.js';
import { pool } from './db/pool.js';

const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const firstEmail = `integration-one-${unique}@example.com`;
const secondEmail = `integration-two-${unique}@example.com`;
const password = 'integration-password';
const players = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const app = createApp();
const firstUser = request.agent(app);
const secondUser = request.agent(app);
let savedPlayerId: number;
let savedGroupId: number;

beforeAll(async () => {
  await runMigrations();
  // Running migrations twice also verifies that the migration history is idempotent.
  await runMigrations();
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1::TEXT[])', [[firstEmail, secondEmail]]);
  await pool.end();
});

describe('PostgreSQL-backed API', () => {
  it('registers users with a secure session cookie and rejects duplicates', async () => {
    const registration = await firstUser
      .post('/api/auth/register')
      .send({ email: firstEmail, password, displayName: 'First User' })
      .expect(201);
    expect(registration.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(registration.body).toEqual({
      email: firstEmail,
      displayName: 'First User',
      premium: false,
      premiumExpiresAt: null,
    });

    await request(app)
      .post('/api/auth/register')
      .send({ email: firstEmail, password, displayName: 'Duplicate' })
      .expect(409);
    await firstUser.get('/api/auth/me').expect(200);
    await secondUser
      .post('/api/auth/register')
      .send({ email: secondEmail, password, displayName: 'Second User' })
      .expect(201);
  });

  it('creates, updates, loads, and isolates reusable player groups', async () => {
    const created = await firstUser
      .post('/api/groups')
      .send({ name: 'Friday crew', players: ['Alice', 'Bob'] })
      .expect(201);
    savedGroupId = created.body.id;
    expect(created.body).toEqual({
      id: savedGroupId,
      name: 'Friday crew',
      players: ['Alice', 'Bob'],
    });
    await firstUser
      .put(`/api/groups/${savedGroupId}`)
      .send({ name: 'Friday crew', players: ['Alice', 'Bob', 'Cleo'] })
      .expect(200);
    const groups = await firstUser.get('/api/groups').expect(200);
    expect(groups.body[0].players).toEqual(['Alice', 'Bob', 'Cleo']);
    await secondUser.get('/api/groups').expect(200, []);
    await secondUser.delete(`/api/groups/${savedGroupId}`).expect(404);
  });

  it('updates personal details and securely changes passwords', async () => {
    await firstUser
      .patch('/api/auth/profile')
      .send({ email: firstEmail, displayName: 'Updated User' })
      .expect(200);
    await firstUser
      .post('/api/auth/password')
      .send({ currentPassword: 'wrong-password', newPassword: 'new-integration-password' })
      .expect(401);
    await firstUser
      .post('/api/auth/password')
      .send({ currentPassword: password, newPassword: 'new-integration-password' })
      .expect(204);
  });

  it('keeps saved players unique and scoped to their owner', async () => {
    const saved = await firstUser.post('/api/players').send({ name: 'Alice' }).expect(201);
    savedPlayerId = saved.body.id;
    await firstUser.post('/api/players').send({ name: 'alice' }).expect(409);
    await firstUser.get('/api/players').expect(200, [{ id: savedPlayerId, name: 'Alice' }]);

    await secondUser.delete(`/api/players/${savedPlayerId}`).expect(404);
  });

  it('records successful authenticated games and aggregates statistics', async () => {
    await firstUser.post('/api/games/cards/draw').send(players).expect(403);
    await firstUser.post('/api/games/dice/roll').send(players).expect(200);
    await firstUser.post('/api/games/slots/spin').send(players).expect(200);
    await firstUser.post('/api/auth/upgrade').expect(200);
    const subscription = await firstUser.get('/api/payments/subscription/status').expect(200);
    expect(subscription.body).toEqual({
      active: true,
      autoRenewing: false,
      premiumExpiresAt: null,
    });
    await firstUser.post('/api/games/cards/draw').send(players).expect(200);

    const statistics = await firstUser.get('/api/statistics').expect(200);
    expect(statistics.body.totalPlays).toBe(3);
    expect(statistics.body.byGame).toEqual({ wheel: 0, dice: 1, slots: 1, cards: 1 });
    expect(['dice', 'slots', 'cards']).toContain(statistics.body.favoriteGame);

    const secondStatistics = await secondUser.get('/api/statistics').expect(200);
    expect(secondStatistics.body.totalPlays).toBe(0);
  });

  it('clears the session cookie on logout', async () => {
    await firstUser.post('/api/auth/logout').expect(204);
    await firstUser.get('/api/auth/me').expect(401);
  });
});

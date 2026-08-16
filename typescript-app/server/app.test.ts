import type { HandlerResponse } from '@netlify/functions';
import request from 'supertest';
import serverless from 'serverless-http';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { pool } from './db/pool.js';

const app = createApp();
const players = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

afterAll(async () => {
  await pool.end();
});

describe('public API', () => {
  it('exposes health and non-secret public configuration', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    await request(app).get('/api/config').expect(200, {
      mockUpgradeEnabled: true,
      goPayConfigured: false,
      premiumPrice: {
        amountMinor: 200,
        formatted: '€2',
        currency: 'EUR',
        interval: 'month',
      },
    });
    await request(app).get('/api/wheel/health').expect(200, 'Dilemma Killer API is running!');
  });

  it('shows free games and locks Card Draw for anonymous users', async () => {
    const response = await request(app).get('/api/games').expect(200);
    expect(response.body.map((game: { id: string }) => game.id)).toEqual(['wheel', 'dice', 'slots', 'cards']);
    expect(response.body[0].locked).toBe(false);
    expect(response.body[2].locked).toBe(false);
    expect(response.body[3].locked).toBe(true);
  });

  it('allows an anonymous dice roll but rejects the premium card game', async () => {
    const diceResponse = await request(app).post('/api/games/dice/roll').send(players).expect(200);
    expect(diceResponse.body.rolls).toHaveLength(2);
    const slotsResponse = await request(app).post('/api/games/slots/spin').send(players).expect(200);
    expect(slotsResponse.body.winner).toBeDefined();
    await request(app).post('/api/games/cards/draw').send(players).expect(403);
  });

  it('requires authentication for saved players and statistics', async () => {
    await request(app).get('/api/players').expect(401);
    await request(app).get('/api/groups').expect(401);
    await request(app).get('/api/statistics').expect(401);
    await request(app).post('/api/payments/gopay').expect(401);
    await request(app).get('/api/payments/subscription/status').expect(401);
  });

  it('validates player lists and unknown API routes', async () => {
    await request(app).post('/api/games/dice/roll').send(players.slice(0, 1)).expect(400);
    await request(app).get('/api/unknown').expect(404, { message: 'Not found' });
  });

  it('returns 413 for oversized JSON bodies', async () => {
    await request(app)
      .post('/api/games/dice/roll')
      .send({ payload: 'x'.repeat(40_000) })
      .expect(413, { message: 'Request body is too large' });
  });

  it('handles authentication requests from a legacy Netlify Function event', async () => {
    const handler = serverless(app);
    const body = JSON.stringify({
      email: 'not-an-email',
      password: 'diagnostic-password',
    });
    const response = await handler({
      path: '/api/auth/login',
      httpMethod: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        'x-forwarded-for': '203.0.113.10',
        'x-nf-client-connection-ip': '203.0.113.10',
      },
      body,
      isBase64Encoded: false,
    }, {}) as HandlerResponse;

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? '')).toEqual({
      message: 'email: Enter a valid email address',
    });
  });
});

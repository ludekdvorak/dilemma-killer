import { describe, expect, it } from 'vitest';
import { needsDatabaseInitialization } from '../netlify/database-gate.js';

describe('Netlify cold-start database gate', () => {
  it.each(['/api/health', '/api/config', '/api/wheel/health', '/api/auth/google/config'])('serves %s without a migration wait', (path) => {
    expect(needsDatabaseInitialization('GET', path, true)).toBe(false);
  });
  it('lets guests check their session, browse games and play free games immediately', () => {
    for (const path of ['/api/auth/me', '/api/games']) {
      expect(needsDatabaseInitialization('GET', path, false)).toBe(false);
      expect(needsDatabaseInitialization('GET', path, true)).toBe(true);
    }
    for (const path of ['/api/wheel/spin', '/api/games/dice/roll', '/api/games/slots/spin', '/api/games/cards/draw']) {
      expect(needsDatabaseInitialization('POST', path, false)).toBe(false);
      expect(needsDatabaseInitialization('POST', path, true)).toBe(true);
    }
  });
  it('keeps database initialization for registration, Google sign-in and protected data', () => {
    for (const path of ['/api/auth/google', '/api/auth/register', '/api/auth/login', '/api/players', '/api/games/roulette/spin', '/api/games/horserace/race', '/api/games/bomb/start']) {
      expect(needsDatabaseInitialization('POST', path, false)).toBe(true);
    }
    expect(needsDatabaseInitialization('GET', '/api/ready', false)).toBe(true);
  });
});

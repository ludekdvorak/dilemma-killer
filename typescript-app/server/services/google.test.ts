import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const keyResolver = vi.hoisted(() => vi.fn());
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return { ...actual, createRemoteJWKSet: () => keyResolver };
});
vi.mock('../config.js', () => ({ config: {
  googleClientId: 'dilemma-test.apps.googleusercontent.com',
  jwtSecret: 'google-test-secret-at-least-thirty-two-characters',
  isProduction: false,
} }));

import { createGoogleChallenge, verifyGoogleCredential } from './google.js';

let privateKey: CryptoKey;
beforeAll(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  keyResolver.mockImplementation(createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'test' }] }));
});
afterAll(() => vi.restoreAllMocks());

async function token(nonce: string, overrides: JWTPayload = {}) {
  return new SignJWT({
    sub: 'google-user-123', email: 'alice@gmail.com', email_verified: true,
    name: 'Alice', nonce, iss: 'https://accounts.google.com',
    aud: 'dilemma-test.apps.googleusercontent.com',
    iat: Math.floor(Date.now() / 1_000), exp: Math.floor(Date.now() / 1_000) + 300,
    ...overrides,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(privateKey);
}

describe('Google identity verification', () => {
  it('accepts a signed Google identity bound to this browser challenge', async () => {
    const { nonce, challenge } = await createGoogleChallenge();
    await expect(verifyGoogleCredential(await token(nonce), challenge)).resolves.toEqual({
      subject: 'google-user-123', email: 'alice@gmail.com', displayName: 'Alice',
    });
  });

  it.each([
    { aud: 'another-app' }, { iss: 'https://attacker.example' }, { exp: 1 },
    { email_verified: false }, { nonce: 'another-browser' }, { sub: '' },
    { azp: 'another-app' }, { email: 'invalid' },
  ])('rejects invalid identity claims %j', async (claims) => {
    const { nonce, challenge } = await createGoogleChallenge();
    await expect(verifyGoogleCredential(await token(nonce, claims), challenge)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects missing or forged browser challenges before resolving Google keys', async () => {
    const calls = keyResolver.mock.calls.length;
    await expect(verifyGoogleCredential('credential', undefined)).rejects.toMatchObject({ status: 401 });
    await expect(verifyGoogleCredential('credential', 'forged')).rejects.toMatchObject({ status: 401 });
    expect(keyResolver.mock.calls).toHaveLength(calls);
  });

  it('rejects a token signed by another key', async () => {
    const { nonce, challenge } = await createGoogleChallenge();
    const attacker = await generateKeyPair('RS256');
    const forged = await new SignJWT({ nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(attacker.privateKey);
    await expect(verifyGoogleCredential(forged, challenge)).rejects.toMatchObject({ status: 401 });
  });
});

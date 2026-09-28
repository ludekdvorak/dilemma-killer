import { randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { emailSchema } from '../validation.js';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  timeoutDuration: 5_000,
});
const challengeKey = new TextEncoder().encode(config.jwtSecret);
export const googleChallengeCookie = 'dilemma_google_challenge';
export const googleChallengeOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict',
  path: '/api/auth/google',
} as const;

export async function createGoogleChallenge() {
  const nonce = randomBytes(32).toString('base64url');
  const challenge = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('google-sign-in')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(challengeKey);
  return { nonce, challenge };
}

const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: emailSchema,
  email_verified: z.literal(true),
  name: z.string().optional(),
  nonce: z.string().min(1),
});

export async function verifyGoogleCredential(credential: string, challenge: string | undefined) {
  if (!config.googleClientId) throw new HttpError(503, 'Google sign-in is not available yet');
  if (!challenge) throw new HttpError(401, 'Reopen sign-in to try Google again');

  try {
    const { payload: session } = await jwtVerify(challenge, challengeKey, {
      algorithms: ['HS256'],
      audience: 'google-sign-in',
      requiredClaims: ['exp', 'iat', 'nonce'],
    });
    const { payload } = await jwtVerify(credential, googleKeys, {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: config.googleClientId,
      requiredClaims: ['exp', 'iat', 'sub'],
    });
    const identity = identitySchema.parse(payload);
    if (identity.nonce !== session.nonce) throw new Error('Nonce mismatch');
    if (payload.azp !== undefined && payload.azp !== config.googleClientId) {
      throw new Error('Authorized party mismatch');
    }
    return {
      subject: identity.sub,
      email: identity.email,
      displayName: (identity.name?.trim() || identity.email.split('@')[0]).slice(0, 30),
    };
  } catch {
    throw new HttpError(401, 'Could not verify Google sign-in. Please try again.');
  }
}

import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { createToken, mapUserRow, requireAuth, toUserProfile, type CurrentUser } from '../auth.js';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { emailSchema, passwordSchema } from '../validation.js';

interface UserWithPasswordRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  premium: boolean;
  created_at: Date;
}

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Display name is required').max(30),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'Password is too long',
  ),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

async function setSessionCookie(response: Response, user: CurrentUser): Promise<void> {
  response.cookie(config.authCookieName, await createToken(user.id), {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: config.jwtExpirationSeconds * 1_000,
    path: '/',
  });
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (request, response) => {
  const input = registerSchema.parse(request.body);
  const passwordHash = await hash(input.password, 12);
  const result = await pool.query<UserWithPasswordRow>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, password_hash, display_name, premium, created_at`,
    [input.email, passwordHash, input.displayName],
  );
  const user = mapUserRow(result.rows[0]);
  await setSessionCookie(response, user);
  response.status(201).json(toUserProfile(user));
});

authRouter.post('/login', authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await pool.query<UserWithPasswordRow>(
    `SELECT id, email, password_hash, display_name, premium, created_at
     FROM users
     WHERE email = $1`,
    [input.email],
  );
  const row = result.rows[0];
  if (!row || !(await compare(input.password, row.password_hash))) {
    throw new HttpError(401, 'Invalid credentials');
  }
  const user = mapUserRow(row);
  await setSessionCookie(response, user);
  response.json(toUserProfile(user));
});

authRouter.post('/logout', (_request, response) => {
  response.clearCookie(config.authCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
  response.status(204).end();
});

authRouter.get('/me', requireAuth, (request, response) => {
  response.json(toUserProfile(request.user!));
});

authRouter.post('/upgrade', requireAuth, async (request, response) => {
  if (!config.allowMockUpgrade) {
    throw new HttpError(403, 'Demo premium upgrades are disabled');
  }
  const result = await pool.query<UserWithPasswordRow>(
    `UPDATE users
     SET premium = TRUE
     WHERE id = $1
     RETURNING id, email, password_hash, display_name, premium, created_at`,
    [request.user!.id],
  );
  response.json(toUserProfile(mapUserRow(result.rows[0])));
});

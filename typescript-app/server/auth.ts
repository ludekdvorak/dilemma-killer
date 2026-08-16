import type { RequestHandler } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { UserProfile } from '../shared/contracts.js';
import { config } from './config.js';
import { pool } from './db/pool.js';

export interface CurrentUser {
  id: number;
  email: string;
  displayName: string;
  premium: boolean;
  premiumExpiresAt: Date | null;
  createdAt: Date;
}

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  premium: boolean;
  premium_expires_at: Date | null;
  created_at: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

const jwtKey = new TextEncoder().encode(config.jwtSecret);

export function toUserProfile(user: CurrentUser): UserProfile {
  return {
    email: user.email,
    displayName: user.displayName,
    premium: user.premium,
    premiumExpiresAt: user.premiumExpiresAt?.toISOString() ?? null,
  };
}

export function mapUserRow(row: UserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    premium: row.premium && (!row.premium_expires_at || row.premium_expires_at > new Date()),
    premiumExpiresAt: row.premium_expires_at,
    createdAt: row.created_at,
  };
}

export async function createToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${config.jwtExpirationSeconds}s`)
    .sign(jwtKey);
}

async function authenticateToken(token: string): Promise<CurrentUser | undefined> {
  let subject: string | undefined;
  try {
    const { payload } = await jwtVerify(token, jwtKey, { algorithms: ['HS256'] });
    subject = payload.sub;
  } catch {
    return undefined;
  }

  const userId = Number(subject);
  if (!Number.isSafeInteger(userId) || userId < 1) return undefined;

  const result = await pool.query<UserRow>(
    `SELECT id, email, display_name, premium, premium_expires_at, created_at
     FROM users
     WHERE id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? mapUserRow(row) : undefined;
}

export const optionalAuth: RequestHandler = async (request, _response, next) => {
  const path = request.originalUrl.split('?')[0];
  if (
    request.method === 'POST'
    && ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(path)
  ) {
    next();
    return;
  }
  const token = request.cookies?.[config.authCookieName] as string | undefined;
  if (token) request.user = await authenticateToken(token);
  next();
};

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.user) {
    response.status(401).json({ message: 'Authentication required' });
    return;
  }
  next();
};

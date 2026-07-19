import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { GameId } from '../../shared/contracts.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';
import { drawCard, isGameLocked, listGames, rollDice, spinWheel } from '../services/games.js';
import { playersSchema } from '../validation.js';

const gameActionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => request.user
    ? `user:${request.user.id}`
    : `ip:${ipKeyGenerator(request.ip ?? 'unknown')}`,
  message: { message: 'Too many game actions. Please wait a moment.' },
});

async function recordPlay(userId: number | undefined, gameId: GameId, playerCount: number): Promise<void> {
  if (!userId) return;
  await pool.query(
    `INSERT INTO game_plays (user_id, game_id, player_count)
     VALUES ($1, $2, $3)`,
    [userId, gameId, playerCount],
  );
}

function requireUnlocked(gameId: GameId, premium: boolean): void {
  if (isGameLocked(gameId, premium)) {
    throw new HttpError(403, 'Premium is required for this game');
  }
}

export const gamesRouter = Router();

gamesRouter.get('/', (request, response) => {
  response.json(listGames(request.user?.premium ?? false));
});

gamesRouter.post('/dice/roll', gameActionLimiter, async (request, response) => {
  requireUnlocked('dice', request.user?.premium ?? false);
  const players = playersSchema.parse(request.body);
  const result = rollDice(players);
  await recordPlay(request.user?.id, 'dice', players.length);
  response.json(result);
});

gamesRouter.post('/cards/draw', gameActionLimiter, async (request, response) => {
  requireUnlocked('cards', request.user?.premium ?? false);
  const players = playersSchema.parse(request.body);
  const result = drawCard(players);
  await recordPlay(request.user?.id, 'cards', players.length);
  response.json(result);
});

export const wheelRouter = Router();

wheelRouter.post('/spin', gameActionLimiter, async (request, response) => {
  requireUnlocked('wheel', request.user?.premium ?? false);
  const players = playersSchema.parse(request.body);
  const result = spinWheel(players);
  await recordPlay(request.user?.id, 'wheel', players.length);
  response.json(result);
});

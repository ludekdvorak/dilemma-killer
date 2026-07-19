import { Router } from 'express';
import { GAME_IDS, type GameId, type UserStatistics } from '../../shared/contracts.js';
import { requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';

interface CountRow {
  game_id: GameId;
  plays: number;
  last_played_at: Date;
}

export const statisticsRouter = Router();
statisticsRouter.use(requireAuth);

statisticsRouter.get('/', async (request, response) => {
  const result = await pool.query<CountRow>(
    `SELECT game_id, COUNT(*)::BIGINT AS plays, MAX(played_at) AS last_played_at
     FROM game_plays
     WHERE user_id = $1
     GROUP BY game_id`,
    [request.user!.id],
  );

  const byGame: Record<GameId, number> = { wheel: 0, dice: 0, cards: 0 };
  let lastPlayedAt: Date | null = null;

  for (const row of result.rows) {
    byGame[row.game_id] = row.plays;
    if (!lastPlayedAt || row.last_played_at > lastPlayedAt) {
      lastPlayedAt = row.last_played_at;
    }
  }

  const totalPlays = GAME_IDS.reduce((sum, gameId) => sum + byGame[gameId], 0);
  const favoriteGame = totalPlays === 0
    ? null
    : GAME_IDS.reduce((favorite, gameId) => (
        byGame[gameId] > byGame[favorite] ? gameId : favorite
      ));

  const statistics: UserStatistics = {
    totalPlays,
    byGame,
    favoriteGame,
    lastPlayedAt: lastPlayedAt?.toISOString() ?? null,
    memberSince: request.user!.createdAt.toISOString(),
  };

  response.json(statistics);
});

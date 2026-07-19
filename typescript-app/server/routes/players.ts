import { Router } from 'express';
import { z } from 'zod';
import type { SavedPlayer } from '../../shared/contracts.js';
import { requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';

interface SavedPlayerRow {
  id: number;
  name: string;
}

const savedPlayerSchema = z.object({
  name: z.string().trim().min(1, 'Player name is required').max(20),
});

const idSchema = z.coerce.number().int().positive();

function toSavedPlayer(row: SavedPlayerRow): SavedPlayer {
  return { id: row.id, name: row.name };
}

export const playersRouter = Router();
playersRouter.use(requireAuth);

playersRouter.get('/', async (request, response) => {
  const result = await pool.query<SavedPlayerRow>(
    `SELECT id, name
     FROM saved_players
     WHERE owner_id = $1
     ORDER BY created_at ASC, id ASC`,
    [request.user!.id],
  );
  response.json(result.rows.map(toSavedPlayer));
});

playersRouter.post('/', async (request, response) => {
  const input = savedPlayerSchema.parse(request.body);
  const result = await pool.query<SavedPlayerRow>(
    `INSERT INTO saved_players (owner_id, name)
     VALUES ($1, $2)
     RETURNING id, name`,
    [request.user!.id, input.name],
  );
  response.status(201).json(toSavedPlayer(result.rows[0]));
});

playersRouter.delete('/:id', async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const result = await pool.query(
    `DELETE FROM saved_players
     WHERE id = $1 AND owner_id = $2`,
    [id, request.user!.id],
  );
  if (result.rowCount === 0) {
    throw new HttpError(404, 'Saved player not found');
  }
  response.status(204).end();
});

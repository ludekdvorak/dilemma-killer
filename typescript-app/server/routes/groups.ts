import { Router } from 'express';
import { z } from 'zod';
import type { SavedGroup } from '../../shared/contracts.js';
import { requireAuth } from '../auth.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../errors.js';

interface GroupRow {
  id: number;
  name: string;
  players: string[];
}

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(40),
  players: z.array(z.string().trim().min(1).max(20)).min(2).max(50),
});

const idSchema = z.coerce.number().int().positive();

function toSavedGroup(row: GroupRow): SavedGroup {
  return { id: row.id, name: row.name, players: row.players };
}

async function getGroups(ownerId: number): Promise<SavedGroup[]> {
  const result = await pool.query<GroupRow>(
    `SELECT groups.id, groups.name,
       COALESCE(
         ARRAY_AGG(members.name ORDER BY members.position)
           FILTER (WHERE members.id IS NOT NULL),
         ARRAY[]::VARCHAR[]
       ) AS players
     FROM saved_groups groups
     LEFT JOIN saved_group_members members ON members.group_id = groups.id
     WHERE groups.owner_id = $1
     GROUP BY groups.id
     ORDER BY groups.updated_at DESC, groups.id DESC`,
    [ownerId],
  );
  return result.rows.map(toSavedGroup);
}

async function replaceMembers(
  client: import('pg').PoolClient,
  groupId: number,
  players: string[],
): Promise<void> {
  await client.query('DELETE FROM saved_group_members WHERE group_id = $1', [groupId]);
  await client.query(
    `INSERT INTO saved_group_members (group_id, name, position)
     SELECT $1, player.name, (player.ordinal - 1)::SMALLINT
     FROM UNNEST($2::TEXT[]) WITH ORDINALITY AS player(name, ordinal)`,
    [groupId, players],
  );
}

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get('/', async (request, response) => {
  response.json(await getGroups(request.user!.id));
});

groupsRouter.post('/', async (request, response) => {
  const input = groupSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query<{ id: number }>(
      `INSERT INTO saved_groups (owner_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [request.user!.id, input.name],
    );
    await replaceMembers(client, created.rows[0].id, input.players);
    await client.query('COMMIT');
    const groups = await getGroups(request.user!.id);
    response.status(201).json(groups.find(({ id }) => id === created.rows[0].id));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

groupsRouter.put('/:id', async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = groupSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE saved_groups
       SET name = $3, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2`,
      [id, request.user!.id, input.name],
    );
    if (updated.rowCount === 0) throw new HttpError(404, 'Group not found');
    await replaceMembers(client, id, input.players);
    await client.query('COMMIT');
    const groups = await getGroups(request.user!.id);
    response.json(groups.find((group) => group.id === id));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

groupsRouter.delete('/:id', async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const result = await pool.query(
    'DELETE FROM saved_groups WHERE id = $1 AND owner_id = $2',
    [id, request.user!.id],
  );
  if (result.rowCount === 0) throw new HttpError(404, 'Group not found');
  response.status(204).end();
});

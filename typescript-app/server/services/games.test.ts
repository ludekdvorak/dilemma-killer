import { describe, expect, it } from 'vitest';
import type { Player } from '../../shared/contracts.js';
import { drawCard, listGames, rollDice, spinSlots, spinWheel } from './games.js';

const players: Player[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Cleo' },
];

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe('game catalog', () => {
  it('locks only Card Draw for a free user', () => {
    const games = listGames(false);
    expect(games.map(({ id }) => id)).toEqual(['wheel', 'dice', 'slots', 'cards']);
    expect(games.map(({ locked }) => locked)).toEqual([false, false, false, true]);
  });

  it('unlocks all games for a premium user', () => {
    expect(listGames(true).every(({ locked }) => !locked)).toBe(true);
  });
});

describe('game results', () => {
  it('selects a wheel winner and returns a multi-turn rotation', () => {
    const result = spinWheel(players, sequence([0.4, 0, 0.5]));
    expect(result.winner).toEqual(players[1]);
    expect(result.winnerIndex).toBe(1);
    expect(result.rotationDegrees).toBe(5 * 360 + 180);
    const winnerCenterDegrees = (result.winnerIndex + 0.5) * (360 / players.length);
    expect((result.rotationDegrees + winnerCenterDegrees) % 360).toBe(0);
  });

  it('rolls for everyone and preserves every player in a top tie', () => {
    const result = rollDice(players, sequence([0.99, 0.99, 0]));
    expect(result.rolls.map(({ roll }) => roll)).toEqual([6, 6, 1]);
    expect(result.winnerIndexes).toEqual([0, 1]);
    expect(result.winners).toEqual([players[0], players[1]]);
  });

  it('draws a valid card for a selected player', () => {
    const result = drawCard(players, sequence([0.8, 0.99, 0.3]));
    expect(result.winner).toEqual(players[2]);
    expect(result.card).toBe('A♥');
  });

  it('selects the winner that all three slot reels will display', () => {
    const result = spinSlots(players, () => 0.6);
    expect(result.winnerIndex).toBe(1);
    expect(result.winner).toEqual(players[1]);
  });

  it('rejects fewer than two players', () => {
    expect(() => rollDice([], () => 0)).toThrow('At least two players are required');
  });
});

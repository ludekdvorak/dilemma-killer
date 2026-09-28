import { describe, expect, it } from 'vitest';
import type { Player } from '../../shared/contracts.js';
import { drawCard, listGames, raceHorses, rollDice, spinRoulette, spinSlots, spinWheel, startBomb } from './games.js';

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
  it('locks only Roulette, Horse Racing, and Ticking Bomb for a free user', () => {
    const games = listGames(false);
    expect(games.map(({ id }) => id)).toEqual(['wheel', 'dice', 'slots', 'cards', 'roulette', 'horserace', 'bomb']);
    expect(games.map(({ locked }) => locked)).toEqual([false, false, false, false, true, true, true]);
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

  it('draws one of the player-name cards', () => {
    const result = drawCard(players, sequence([0.8]));
    expect(result.winner).toEqual(players[2]);
    expect(result.winnerIndex).toBe(2);
  });

  it('selects the winner that all three slot reels will display', () => {
    const result = spinSlots(players, () => 0.6);
    expect(result.winnerIndex).toBe(1);
    expect(result.winner).toEqual(players[1]);
  });

  it('chooses a roulette pocket with equal odds for each player', () => {
    const result = spinRoulette(players, sequence([0.8]));
    expect(result.winnerIndex).toBe(2);
    expect(result.winner).toEqual(players[2]);
  });

  it('returns a complete finish order with its winner first', () => {
    const result = raceHorses(players, sequence([0.2, 0.9]));
    expect([...result.finishOrder].sort()).toEqual([0, 1, 2]);
    expect(result.winnerIndex).toBe(result.finishOrder[0]);
    expect(result.winner).toEqual(players[result.winnerIndex]);
  });

  it('starts the bomb at a player with a bounded fuse', () => {
    expect(startBomb(players, sequence([0.99, 0]))).toEqual({ startingIndex: 2, fuseMs: 8_000 });
    expect(startBomb(players, sequence([0, 1])).fuseMs).toBe(13_000);
  });

  it('rejects fewer than two players', () => {
    expect(() => rollDice([], () => 0)).toThrow('At least two players are required');
  });
});

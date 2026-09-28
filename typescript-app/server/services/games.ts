import type {
  CardResult,
  DiceResult,
  GameId,
  GameSummary,
  Player,
  SlotResult,
  SpinResult,
  RaceResult,
  BombResult,
  RouletteResult,
} from '../../shared/contracts.js';

import { GAME_DEFINITIONS } from '../../shared/games.js';

type RandomSource = () => number;

function randomIndex(length: number, random: RandomSource): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

function requirePlayers(players: Player[]): void {
  if (players.length < 2) {
    throw new Error('At least two players are required');
  }
}

export function listGames(premium: boolean): GameSummary[] {
  return GAME_DEFINITIONS.map((game) => ({
    ...game,
    locked: game.premium && !premium,
  }));
}

export function isGameLocked(gameId: GameId, premium: boolean): boolean {
  const game = GAME_DEFINITIONS.find((candidate) => candidate.id === gameId);
  return !game || (game.premium && !premium);
}

export function spinWheel(players: Player[], random: RandomSource = Math.random): SpinResult {
  requirePlayers(players);
  const winnerIndex = randomIndex(players.length, random);
  const segmentSize = 360 / players.length;
  const baseRotations = (5 + randomIndex(5, random)) * 360;
  const winnerAngle = winnerIndex * segmentSize + segmentSize / 2;
  const randomOffset = (random() - 0.5) * segmentSize * 0.6;
  // Segments are drawn from -90 degrees, directly beneath the top pointer.
  const targetAngle = 360 - winnerAngle + randomOffset;

  return {
    winner: players[winnerIndex],
    winnerIndex,
    rotationDegrees: baseRotations + ((targetAngle % 360) + 360) % 360,
  };
}

export function rollDice(players: Player[], random: RandomSource = Math.random): DiceResult {
  requirePlayers(players);
  const rolls = players.map((player) => ({
    player,
    roll: 1 + randomIndex(6, random),
  }));
  const highestRoll = Math.max(...rolls.map(({ roll }) => roll));
  const topIndexes = rolls
    .map(({ roll }, index) => ({ roll, index }))
    .filter(({ roll }) => roll === highestRoll)
    .map(({ index }) => index);

  return {
    rolls,
    winners: topIndexes.map((index) => players[index]),
    winnerIndexes: topIndexes,
  };
}

export function drawCard(players: Player[], random: RandomSource = Math.random): CardResult {
  requirePlayers(players);
  const winnerIndex = randomIndex(players.length, random);
  return { winner: players[winnerIndex], winnerIndex };
}

export function spinSlots(players: Player[], random: RandomSource = Math.random): SlotResult {
  requirePlayers(players);
  const winnerIndex = randomIndex(players.length, random);
  return { winner: players[winnerIndex], winnerIndex };
}

export function spinRoulette(players: Player[], random: RandomSource = Math.random): RouletteResult {
  requirePlayers(players);
  const winnerIndex = randomIndex(players.length, random);
  return { winner: players[winnerIndex], winnerIndex };
}

export function raceHorses(players: Player[], random: RandomSource = Math.random): RaceResult {
  requirePlayers(players);
  const finishOrder = players.map((_, index) => index);
  for (let index = finishOrder.length - 1; index > 0; index--) {
    const swap = randomIndex(index + 1, random);
    [finishOrder[index], finishOrder[swap]] = [finishOrder[swap], finishOrder[index]];
  }
  const winnerIndex = finishOrder[0];
  return { winner: players[winnerIndex], winnerIndex, finishOrder };
}

export function startBomb(players: Player[], random: RandomSource = Math.random): BombResult {
  requirePlayers(players);
  return { startingIndex: randomIndex(players.length, random), fuseMs: 8_000 + randomIndex(5_001, random) };
}

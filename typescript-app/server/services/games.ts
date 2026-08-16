import type {
  CardResult,
  DiceResult,
  GameId,
  GameSummary,
  Player,
  SlotResult,
  SpinResult,
} from '../../shared/contracts.js';

type RandomSource = () => number;

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

const GAME_DEFINITIONS: ReadonlyArray<Omit<GameSummary, 'locked'>> = [
  {
    id: 'wheel',
    name: 'Lucky Wheel',
    description: 'Spin the wheel and randomly select one player',
    icon: '🎡',
    premium: false,
  },
  {
    id: 'dice',
    name: 'Dice Roll',
    description: 'Everyone rolls; the highest number wins',
    icon: '🎲',
    premium: false,
  },
  {
    id: 'slots',
    name: 'Winner Slots',
    description: 'Pull the lever and line up a guaranteed winner',
    icon: '🎰',
    premium: false,
  },
  {
    id: 'cards',
    name: 'Card Draw',
    description: 'Draw a card and discover your fate',
    icon: '🃏',
    premium: true,
  },
];

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
  const rank = RANKS[randomIndex(RANKS.length, random)];
  const suit = SUITS[randomIndex(SUITS.length, random)];

  return {
    winner: players[winnerIndex],
    winnerIndex,
    card: `${rank}${suit}`,
  };
}

export function spinSlots(players: Player[], random: RandomSource = Math.random): SlotResult {
  requirePlayers(players);
  const winnerIndex = randomIndex(players.length, random);
  return { winner: players[winnerIndex], winnerIndex };
}

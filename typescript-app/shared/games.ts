import type { GameSummary } from './contracts';

export const GAME_DEFINITIONS: ReadonlyArray<Omit<GameSummary, 'locked'>> = [
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
    premium: false,
  },
  { id: 'roulette', name: 'Roulette', description: 'Throw the ball onto a red or black player pocket', icon: '🔴', premium: true },
  { id: 'horserace', name: 'Horse Racing', description: 'Cheer your horse to the finish', icon: '🏇', premium: true },
  { id: 'bomb', name: 'Ticking Bomb', description: 'Pass it before the fuse runs out', icon: '💣', premium: true },
];

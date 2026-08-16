export const GAME_IDS = ['wheel', 'dice', 'slots', 'cards'] as const;

export type GameId = (typeof GAME_IDS)[number];

export interface Player {
  id: string;
  name: string;
}

export interface UserProfile {
  email: string;
  displayName: string;
  premium: boolean;
  premiumExpiresAt: string | null;
}

export type AuthResponse = UserProfile;

export interface PublicConfig {
  mockUpgradeEnabled: boolean;
  goPayConfigured: boolean;
  premiumPrice: {
    amountMinor: number;
    formatted: string;
    currency: 'EUR';
    interval: 'month';
  };
}

export interface SubscriptionStatus {
  active: boolean;
  autoRenewing: boolean;
  premiumExpiresAt: string | null;
}

export interface SavedPlayer {
  id: number;
  name: string;
}

export interface SavedGroup {
  id: number;
  name: string;
  players: string[];
}

export interface GameSummary {
  id: GameId;
  name: string;
  description: string;
  icon: string;
  premium: boolean;
  locked: boolean;
}

export interface SpinResult {
  winner: Player;
  winnerIndex: number;
  rotationDegrees: number;
}

export interface PlayerRoll {
  player: Player;
  roll: number;
}

export interface DiceResult {
  rolls: PlayerRoll[];
  winners: Player[];
  winnerIndexes: number[];
}

export interface CardResult {
  winner: Player;
  winnerIndex: number;
  card: string;
}

export interface SlotResult {
  winner: Player;
  winnerIndex: number;
}

export interface UserStatistics {
  totalPlays: number;
  byGame: Record<GameId, number>;
  favoriteGame: GameId | null;
  lastPlayedAt: string | null;
  memberSince: string;
}

export interface ApiErrorBody {
  message: string;
}

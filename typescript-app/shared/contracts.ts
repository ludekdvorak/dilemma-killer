export const GAME_IDS = ['wheel', 'dice', 'cards'] as const;

export type GameId = (typeof GAME_IDS)[number];

export interface Player {
  id: string;
  name: string;
}

export interface UserProfile {
  email: string;
  displayName: string;
  premium: boolean;
}

export type AuthResponse = UserProfile;

export interface PublicConfig {
  mockUpgradeEnabled: boolean;
}

export interface SavedPlayer {
  id: number;
  name: string;
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
  winner: Player;
  winnerIndex: number;
}

export interface CardResult {
  winner: Player;
  winnerIndex: number;
  card: string;
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

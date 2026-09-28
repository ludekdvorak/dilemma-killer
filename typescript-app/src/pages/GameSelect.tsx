import type { CSSProperties } from 'react';
import type { GameId, GameSummary, Player } from '../../shared/contracts';
import { GAME_DEFINITIONS } from '../../shared/games';
import GameAccount from '../components/GameAccount';
import { useAuth } from '../context/AuthContext';
import styles from './GameSelect.module.css';

interface GameSelectProps {
  players: Player[];
  onSelectGame: (gameId: GameId) => void;
  onGoToUpgrade: () => void;
  onViewStatistics: () => void;
  onBack: () => void;
  onGoToAuth: () => void;
}

type GameCardStyle = CSSProperties & { '--game-color': string };
const GAME_COLORS: Record<GameId, string> = {
  wheel: '#8b5cf6',
  dice: '#22d3ee',
  slots: '#f6c453',
  cards: '#ff3d81',
  roulette: '#ff536b',
  horserace: '#ffb800',
  bomb: '#a855f7',
};

export default function GameSelect({
  players,
  onSelectGame,
  onGoToUpgrade,
  onViewStatistics,
  onBack,
  onGoToAuth,
}: GameSelectProps) {
  const { user, loading } = useAuth();
  const games = GAME_DEFINITIONS.map((game) => ({
    ...game,
    locked: game.premium && !user?.premium,
  }));

  const handleClick = (game: GameSummary) => {
    if (game.locked) onGoToUpgrade();
    else onSelectGame(game.id);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <GameAccount onGoToAuth={onGoToAuth} />
          {user && <button className={styles.statsBtn} onClick={onViewStatistics}>Your statistics</button>}
        </div>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <div className={styles.eyebrow}>PICK YOUR POISON</div>
        <h1 className={styles.title}>CHOOSE YOUR <span>CHAOS</span></h1>
        <p className={styles.subtitle}>
          <span className={styles.playerCount}>● {players.length} PLAYERS READY</span> Tap a game to start instantly.
        </p>
      </header>

      <section className={styles.grid}>
        {games.map((game) => (
          <button
            key={game.id}
            className={`${styles.gameCard} ${game.locked ? styles.locked : ''}`}
            style={{ '--game-color': GAME_COLORS[game.id] } as GameCardStyle}
            onClick={() => handleClick(game)}
            disabled={game.premium && loading}
            aria-label={`${game.name}${game.locked ? ', Premium, open upgrade' : ', play'}`}
          >
            <div className={styles.gameIcon}>{game.icon}</div>
            <div className={styles.gameInfo}>
              <div className={styles.gameName}>{game.name}</div>
              <div className={styles.gameDesc}>{game.description}</div>
            </div>
            {game.locked ? <div className={styles.comingSoon}>{loading ? 'CHECKING ACCOUNT…' : 'PREMIUM'}</div> : <div className={styles.playArrow}>→</div>}
          </button>
        ))}

      </section>
    </main>
  );
}

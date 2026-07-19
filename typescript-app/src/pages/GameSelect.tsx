import { useEffect, useState, type CSSProperties } from 'react';
import type { GameId, GameSummary, Player } from '../../shared/contracts';
import { getGames } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './GameSelect.module.css';

const COMING_SOON = [
  { id: 'roulette', icon: '🔴', name: 'Roulette', description: 'Spin your fate', color: '#ef4444' },
  { id: 'horserace', icon: '🏇', name: 'Horse Racing', description: 'Bet on the right horse', color: '#ef4444' },
  { id: 'bomb', icon: '💣', name: 'Ticking Bomb', description: 'Pass it around until it explodes', color: '#e040fb' },
] as const;

interface GameSelectProps {
  players: Player[];
  onSelectGame: (gameId: GameId) => void;
  onGoToUpgrade: () => void;
  onViewStatistics: () => void;
  onBack: () => void;
}

type GameCardStyle = CSSProperties & { '--game-color': string };

export default function GameSelect({
  players,
  onSelectGame,
  onGoToUpgrade,
  onViewStatistics,
  onBack,
}: GameSelectProps) {
  const { user } = useAuth();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getGames(controller.signal)
      .then(setGames)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load games');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user?.premium]);

  const handleClick = (game: GameSummary) => {
    if (game.locked) onGoToUpgrade();
    else onSelectGame(game.id);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          {user && <button className={styles.statsBtn} onClick={onViewStatistics}>Your statistics</button>}
        </div>
        <div className={styles.logo}>⚔️ DILEMMA KILLER</div>
        <h1 className={styles.title}>WHAT ARE WE PLAYING?</h1>
        <p className={styles.subtitle}>
          <span className={styles.playerCount}>{players.length} players</span> ready for battle
        </p>
      </header>

      <section className={styles.grid} aria-busy={loading}>
        {loading && <div className={styles.status}>Loading games…</div>}
        {error && <div className={styles.status} role="alert">{error}</div>}
        {games.map((game) => (
          <button
            key={game.id}
            className={`${styles.gameCard} ${game.locked ? styles.locked : ''}`}
            style={{ '--game-color': game.locked ? '#7c7c9e' : '#ff6b35' } as GameCardStyle}
            onClick={() => handleClick(game)}
          >
            <div className={styles.gameIcon}>{game.icon}</div>
            <div className={styles.gameInfo}>
              <div className={styles.gameName}>{game.name}</div>
              <div className={styles.gameDesc}>{game.description}</div>
            </div>
            {game.locked ? <div className={styles.comingSoon}>PREMIUM</div> : <div className={styles.playArrow}>→</div>}
          </button>
        ))}

        {COMING_SOON.map((game) => (
          <button
            key={game.id}
            className={`${styles.gameCard} ${styles.locked}`}
            style={{ '--game-color': game.color } as GameCardStyle}
            disabled
          >
            <div className={styles.gameIcon}>{game.icon}</div>
            <div className={styles.gameInfo}>
              <div className={styles.gameName}>{game.name}</div>
              <div className={styles.gameDesc}>{game.description}</div>
            </div>
            <div className={styles.comingSoon}>COMING SOON</div>
          </button>
        ))}
      </section>
    </main>
  );
}

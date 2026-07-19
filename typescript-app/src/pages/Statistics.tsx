import { useEffect, useState } from 'react';
import type { GameId, UserStatistics } from '../../shared/contracts';
import { getStatistics } from '../api';
import styles from './Statistics.module.css';

const GAME_LABELS: Record<GameId, { label: string; icon: string }> = {
  wheel: { label: 'Lucky Wheel', icon: '🎡' },
  dice: { label: 'Dice Roll', icon: '🎲' },
  cards: { label: 'Card Draw', icon: '🃏' },
};

interface StatisticsProps {
  onBack: () => void;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not played yet';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value));
}

export default function Statistics({ onBack }: StatisticsProps) {
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getStatistics(controller.signal)
      .then(setStatistics)
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'Could not load statistics');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>⚔️ DILEMMA KILLER</div>
        <h1 className={styles.title}>YOUR STATISTICS</h1>
        <p className={styles.subtitle}>Only games played while signed in are counted.</p>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {!statistics && !error && <div className={styles.loading}>Loading statistics…</div>}

      {statistics && (
        <section className={styles.content}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>TOTAL PLAYS</span>
              <strong className={styles.summaryValue}>{statistics.totalPlays}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>FAVORITE GAME</span>
              <strong className={styles.summaryText}>
                {statistics.favoriteGame ? GAME_LABELS[statistics.favoriteGame].label : 'None yet'}
              </strong>
            </div>
          </div>

          <div className={styles.gameGrid}>
            {(Object.keys(GAME_LABELS) as GameId[]).map((gameId) => (
              <div className={styles.gameCard} key={gameId}>
                <span className={styles.gameIcon}>{GAME_LABELS[gameId].icon}</span>
                <span className={styles.gameName}>{GAME_LABELS[gameId].label}</span>
                <strong className={styles.gameCount}>{statistics.byGame[gameId]}</strong>
              </div>
            ))}
          </div>

          <dl className={styles.details}>
            <div><dt>Last played</dt><dd>{formatDate(statistics.lastPlayedAt)}</dd></div>
            <div><dt>Member since</dt><dd>{formatDate(statistics.memberSince)}</dd></div>
          </dl>

          <p className={styles.privacyNote}>
            Statistics store the game type, player count, and time—not party-player names or results.
          </p>
        </section>
      )}
    </main>
  );
}

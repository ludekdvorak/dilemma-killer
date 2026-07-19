import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Player, SavedPlayer } from '../../shared/contracts';
import { addSavedPlayer, deleteSavedPlayer, getSavedPlayers } from '../api';
import { useAuth } from '../context/AuthContext';
import styles from './PlayerSetup.module.css';

const COLORS = ['#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#e040fb', '#ff4081', '#69f0ae', '#ffab40'];
const MAX_PLAYERS = 50;

interface PlayerSetupProps {
  onStart: (players: Player[]) => void;
  onGoToAuth: () => void;
}

type CardStyle = CSSProperties & { '--card-color': string };

export default function PlayerSetup({ onStart, onGoToAuth }: PlayerSetupProps) {
  const { user, logout } = useAuth();
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Player 1' },
    { id: '2', name: 'Player 2' },
  ]);
  const [input, setInput] = useState('');
  const [roster, setRoster] = useState<SavedPlayer[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setRoster([]);
      return;
    }
    const controller = new AbortController();
    getSavedPlayers(controller.signal).then(setRoster).catch(() => {
      if (!controller.signal.aborted) setRoster([]);
    });
    return () => controller.abort();
  }, [user]);

  const addPlayer = () => {
    const name = input.trim();
    if (!name || players.length >= MAX_PLAYERS) return;
    setPlayers((current) => [...current, { id: crypto.randomUUID(), name }]);
    setInput('');

    if (user && !roster.some((saved) => saved.name.toLowerCase() === name.toLowerCase())) {
      addSavedPlayer(name)
        .then((saved) => {
          if (mountedRef.current) setRoster((current) => [...current, saved]);
        })
        .catch(() => undefined);
    }
  };

  const addFromRoster = (savedPlayer: SavedPlayer) => {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers((current) => [...current, { id: crypto.randomUUID(), name: savedPlayer.name }]);
  };

  const removeFromRoster = (id: number) => {
    deleteSavedPlayer(id)
      .then(() => {
        if (mountedRef.current) {
          setRoster((current) => current.filter((player) => player.id !== id));
        }
      })
      .catch(() => undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') addPlayer();
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>⚔️ DILEMMA KILLER</div>
        <h1 className={styles.title}>WHO&apos;S PLAYING?</h1>
        <p className={styles.subtitle}>Add player names or numbers, then choose a game</p>
        {!user ? (
          <button className={styles.authLink} onClick={onGoToAuth}>
            Sign in to save players for next time →
          </button>
        ) : (
          <div className={styles.accountRow}>
            <span>Signed in as <strong>{user.displayName}</strong>{user.premium ? ' · Premium' : ''}</span>
            <button onClick={() => void logout()}>Sign out</button>
          </div>
        )}
      </header>

      <section className={styles.content}>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Player name or number…"
            maxLength={20}
            aria-label="Player name"
            disabled={players.length >= MAX_PLAYERS}
          />
          <button
            className={styles.addBtn}
            onClick={addPlayer}
            aria-label="Add player"
            disabled={players.length >= MAX_PLAYERS}
          >
            +
          </button>
        </div>

        {players.length >= MAX_PLAYERS && (
          <p className={styles.limitNote}>Maximum of {MAX_PLAYERS} players reached.</p>
        )}

        {user && roster.length > 0 && (
          <div className={styles.rosterRow}>
            <span className={styles.rosterLabel}>YOUR SAVED PLAYERS</span>
            <div className={styles.rosterChips}>
              {roster.map((saved) => (
                <span key={saved.id} className={styles.rosterChip}>
                  <button
                    className={styles.rosterChipAdd}
                    onClick={() => addFromRoster(saved)}
                    disabled={players.length >= MAX_PLAYERS}
                  >
                    {saved.name}
                  </button>
                  <button
                    className={styles.rosterChipRemove}
                    onClick={() => removeFromRoster(saved.id)}
                    aria-label={`Delete saved player ${saved.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.playerGrid}>
          {players.map((player, index) => (
            <div
              key={player.id}
              className={styles.playerCard}
              style={{ '--card-color': COLORS[index % COLORS.length] } as CardStyle}
            >
              <span className={styles.playerNum} style={{ color: COLORS[index % COLORS.length] }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.playerName}>{player.name}</span>
              <button
                className={styles.removeBtn}
                onClick={() => setPlayers((current) => current.filter(({ id }) => id !== player.id))}
                aria-label={`Remove ${player.name}`}
              >
                ×
              </button>
            </div>
          ))}
          {players.length === 0 && (
            <div className={styles.empty}>No players yet. Add at least two!</div>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.count}>
            <span className={styles.countNum}>{players.length}</span>
            <span className={styles.countLabel}>PLAYERS READY</span>
          </div>
          <button
            className={styles.startBtn}
            onClick={() => onStart(players)}
            disabled={players.length < 2}
          >
            CHOOSE A GAME →
          </button>
        </footer>
      </section>
    </main>
  );
}

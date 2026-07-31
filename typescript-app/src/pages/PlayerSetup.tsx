import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Player, SavedGroup, SavedPlayer, UserStatistics } from '../../shared/contracts';
import {
  addSavedPlayer,
  createGroup,
  deleteGroup,
  deleteSavedPlayer,
  getGroups,
  getSavedPlayers,
  getStatistics,
  updateGroup,
} from '../api';
import Dice3D from '../components/Dice3D';
import { useAuth } from '../context/AuthContext';
import styles from './PlayerSetup.module.css';

const COLORS = ['#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#e040fb', '#ff4081', '#69f0ae', '#ffab40'];
const MAX_PLAYERS = 50;

interface PlayerSetupProps {
  onStart: (players: Player[]) => void;
  onGoToAuth: () => void;
  onViewProfile: () => void;
  onViewStatistics: () => void;
}

type CardStyle = CSSProperties & { '--card-color': string };

export default function PlayerSetup({
  onStart,
  onGoToAuth,
  onViewProfile,
  onViewStatistics,
}: PlayerSetupProps) {
  const { user, logout } = useAuth();
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Player 1' },
    { id: '2', name: 'Player 2' },
  ]);
  const [input, setInput] = useState('');
  const [roster, setRoster] = useState<SavedPlayer[]>([]);
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setRoster([]);
      setGroups([]);
      setStatistics(null);
      return;
    }
    const controller = new AbortController();
    void Promise.all([
      getSavedPlayers(controller.signal).then(setRoster),
      getGroups(controller.signal).then(setGroups),
      getStatistics(controller.signal).then(setStatistics),
    ]).catch(() => undefined);
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

  const saveGroup = async () => {
    const name = groupName.trim();
    if (!name || players.length < 2) return;
    setGroupMessage(null);
    try {
      const group = await createGroup(name, players.map((player) => player.name));
      setGroups((current) => [group, ...current]);
      setGroupName('');
      setGroupMessage(`${group.name} saved`);
    } catch (caught) {
      setGroupMessage(caught instanceof Error ? caught.message : 'Could not save group');
    }
  };

  const loadGroup = (group: SavedGroup) => {
    setPlayers(group.players.map((name) => ({ id: crypto.randomUUID(), name })));
    setGroupMessage(`${group.name} loaded`);
  };

  const overwriteGroup = async (group: SavedGroup) => {
    if (players.length < 2) return;
    setGroupMessage(null);
    try {
      const updated = await updateGroup(group.id, group.name, players.map((player) => player.name));
      setGroups((current) => current.map((item) => item.id === group.id ? updated : item));
      setGroupMessage(`${group.name} updated`);
    } catch (caught) {
      setGroupMessage(caught instanceof Error ? caught.message : 'Could not update group');
    }
  };

  const removeGroup = async (group: SavedGroup) => {
    setGroupMessage(null);
    try {
      await deleteGroup(group.id);
      setGroups((current) => current.filter(({ id }) => id !== group.id));
      setGroupMessage(`${group.name} deleted`);
    } catch (caught) {
      setGroupMessage(caught instanceof Error ? caught.message : 'Could not delete group');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') addPlayer();
  };

  return (
    <main className={styles.page}>
      <div className={styles.ambientOrb} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.nav}>
          <div className={styles.logo}><span>🎮</span> DILEMMA KILLER</div>
          {!user ? (
            <button className={styles.loginPill} onClick={onGoToAuth}>⚡ Log in</button>
          ) : (
            <button className={styles.loginPill} onClick={onViewProfile}>◎ My account</button>
          )}
        </div>
        <div className={styles.heroDie}>
          <span className={styles.dieOrbit} aria-hidden="true" />
          <Dice3D value={5} size={92} floating label="Floating three-dimensional die" />
        </div>
        <div className={styles.eyebrow}>THE PARTY STARTS HERE</div>
        <h1 className={styles.title}><span>DILEMMA</span><strong>KILLER</strong></h1>
        <p className={styles.subtitle}>Pick your squad. Choose your game. <em>Let chaos begin.</em></p>
        {!user ? (
          <button className={styles.authLink} onClick={onGoToAuth}>
            Save your squad for next time →
          </button>
        ) : (
          <div className={styles.accountRow}>
            <span>Signed in as <strong>{user.displayName}</strong>{user.premium ? ' · Premium' : ''}</span>
            <button onClick={() => void logout()}>Sign out</button>
          </div>
        )}
      </header>

      {user && statistics && (
        <section className={styles.statsStrip} aria-label="Your statistics">
          <button onClick={onViewStatistics}>
            <span>TOTAL PLAYS</span><strong>{statistics.totalPlays}</strong>
          </button>
          <button onClick={onViewStatistics}>
            <span>FAVORITE</span>
            <strong>{statistics.favoriteGame ? statistics.favoriteGame.toUpperCase() : '—'}</strong>
          </button>
          <button onClick={onViewStatistics}>
            <span>SAVED GROUPS</span><strong>{groups.length}</strong>
          </button>
          <button className={styles.statsMore} onClick={onViewStatistics}>VIEW ALL →</button>
        </section>
      )}

      <section className={styles.content}>
        <div className={styles.sectionLabel}>BUILD YOUR SQUAD</div>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a player name…"
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
            + ADD
          </button>
        </div>

        {players.length >= MAX_PLAYERS && (
          <p className={styles.limitNote}>Maximum of {MAX_PLAYERS} players reached.</p>
        )}

        {user && (
          <div className={styles.groupsPanel}>
            <div className={styles.groupsHeading}>
              <div>
                <span className={styles.rosterLabel}>YOUR GROUPS</span>
                <p>Load a whole squad in one click.</p>
              </div>
              <div className={styles.groupSave}>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveGroup();
                  }}
                  placeholder="Group name"
                  maxLength={40}
                  aria-label="New group name"
                />
                <button onClick={() => void saveGroup()} disabled={!groupName.trim() || players.length < 2}>
                  SAVE GROUP
                </button>
              </div>
            </div>
            {groups.length > 0 ? (
              <div className={styles.groupGrid}>
                {groups.map((group) => (
                  <article className={styles.groupCard} key={group.id}>
                    <button className={styles.groupLoad} onClick={() => loadGroup(group)}>
                      <strong>{group.name}</strong>
                      <span>{group.players.length} players · {group.players.slice(0, 3).join(', ')}{group.players.length > 3 ? '…' : ''}</span>
                    </button>
                    <div className={styles.groupActions}>
                      <button onClick={() => void overwriteGroup(group)} title="Replace this group with the current players">↻</button>
                      <button onClick={() => void removeGroup(group)} title={`Delete ${group.name}`}>×</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.groupEmpty}>Your saved groups will appear here.</p>
            )}
            {groupMessage && <p className={styles.groupMessage}>{groupMessage}</p>}
          </div>
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
            LET&apos;S PLAY <span>→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

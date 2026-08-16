import { useEffect, useRef, useState } from 'react';
import type { Player } from '../../shared/contracts';
import { rollDice } from '../api';
import Dice3D from '../components/Dice3D';
import { prefersReducedMotion } from '../motion';
import styles from './DiceRoll.module.css';

interface DiceRollProps {
  players: Player[];
  onBack: () => void;
}

export default function DiceRoll({ players, onBack }: DiceRollProps) {
  const [faces, setFaces] = useState(players.map(() => 1));
  const [rolling, setRolling] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    requestControllerRef.current?.abort();
  }, []);

  const handleRoll = async () => {
    if (rolling) return;
    setRolling(true);
    setWinnerIndex(null);
    setError(null);
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const result = await rollDice(players, controller.signal);
      if (controller.signal.aborted) return;
      if (prefersReducedMotion()) {
        setFaces(result.rolls.map(({ roll }) => roll));
        setWinnerIndex(result.winnerIndex);
        setRolling(false);
        return;
      }
      intervalRef.current = window.setInterval(() => {
        setFaces(players.map(() => 1 + Math.floor(Math.random() * 6)));
      }, 80);
      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
        setFaces(result.rolls.map(({ roll }) => roll));
        setWinnerIndex(result.winnerIndex);
        setRolling(false);
      }, 1100);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Roll failed');
      setRolling(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.gameTitle}>DICE ROLL</h1>
      </header>

      <div className={styles.grid}>
        {players.map((player, index) => (
          <div key={player.id} className={`${styles.playerDie} ${winnerIndex === index ? styles.winner : ''}`}>
            <Dice3D
              value={faces[index]}
              size={74}
              rolling={rolling}
              label={`${player.name} rolled ${faces[index]}`}
            />
            <span className={styles.playerName}>{player.name}</span>
          </div>
        ))}
      </div>

      {winnerIndex !== null && !rolling && (
        <div className={styles.winnerBanner} role="status" aria-live="polite">
          <div className={styles.winnerLabel}>HIGH ROLLER</div>
          <div className={styles.winnerName}>{players[winnerIndex].name}</div>
        </div>
      )}
      {error && <div className={styles.errorNote} role="alert">{error}</div>}
      <button className={styles.rollBtn} onClick={() => void handleRoll()} disabled={rolling}>
        {rolling ? 'SHAKING THINGS UP…' : winnerIndex !== null ? 'RUN IT BACK ↻' : 'ROLL THE DICE →'}
      </button>
    </main>
  );
}

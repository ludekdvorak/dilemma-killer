import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Player } from '../../shared/contracts';
import { rollDice } from '../api';
import Dice3D from '../components/Dice3D';
import { prefersReducedMotion } from '../motion';
import styles from './DiceRoll.module.css';

interface DiceRollProps {
  players: Player[];
  onBack: () => void;
}

type DieCardStyle = CSSProperties & { '--die-index': number };

export default function DiceRoll({ players, onBack }: DiceRollProps) {
  const [faces, setFaces] = useState(players.map(() => 1));
  const [rolling, setRolling] = useState(false);
  const [rollingDice, setRollingDice] = useState(players.map(() => false));
  const [winnerIndexes, setWinnerIndexes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timeoutRefs = useRef<number[]>([]);
  const requestControllerRef = useRef<AbortController | null>(null);

  const clearAnimationTimers = () => {
    timeoutRefs.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutRefs.current = [];
  };

  useEffect(() => () => {
    clearAnimationTimers();
    requestControllerRef.current?.abort();
  }, []);

  const handleRoll = async () => {
    if (rolling) return;
    clearAnimationTimers();
    setRolling(true);
    setRollingDice(players.map(() => true));
    setWinnerIndexes([]);
    setError(null);
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const startedAt = performance.now();

    setFaces(players.map(() => 1 + Math.floor(Math.random() * 6)));

    try {
      const result = await rollDice(players, controller.signal);
      if (controller.signal.aborted) return;
      const reducedMotion = prefersReducedMotion();
      const minimumRollTime = reducedMotion ? 800 : 5000;
      const settleWindow = reducedMotion ? 250 : 1000;
      const settleStep = players.length > 1 ? settleWindow / (players.length - 1) : 0;
      const initialDelay = Math.max(0, minimumRollTime - (performance.now() - startedAt));

      result.rolls.forEach(({ roll }, index) => {
        const timeout = window.setTimeout(() => {
          setRollingDice((current) => current.map((isRolling, dieIndex) => (
            dieIndex === index ? false : isRolling
          )));
          setFaces((current) => current.map((face, dieIndex) => (
            dieIndex === index ? roll : face
          )));

          if (index === result.rolls.length - 1) {
            clearAnimationTimers();
            setWinnerIndexes(result.winnerIndexes);
            setRolling(false);
          }
        }, initialDelay + settleStep * index);
        timeoutRefs.current.push(timeout);
      });
    } catch (caught) {
      if (controller.signal.aborted) return;
      clearAnimationTimers();
      setRollingDice(players.map(() => false));
      setError(caught instanceof Error ? caught.message : 'Roll failed');
      setRolling(false);
    }
  };

  const highestRoll = winnerIndexes.length > 0 ? faces[winnerIndexes[0]] : null;
  const tied = winnerIndexes.length > 1;

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.gameTitle}>DICE ROLL</h1>
      </header>

      <div className={styles.grid}>
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`${styles.playerDie} ${rollingDice[index] ? styles.rolling : ''} ${winnerIndexes.includes(index) ? styles.winner : ''}`}
            style={{ '--die-index': index } as DieCardStyle}
          >
            <div className={styles.dieStage}>
              <span className={styles.dieShadow} />
              <Dice3D
                value={faces[index]}
                size={82}
                rolling={rollingDice[index]}
                label={rollingDice[index] ? `${player.name}'s die is rolling` : `${player.name} rolled ${faces[index]}`}
              />
            </div>
            <span className={styles.playerName}>{player.name}</span>
            <span className={styles.rollValue}>
              {rollingDice[index] ? 'ROLLING…' : rolling ? `ROLLED ${faces[index]}` : winnerIndexes.length > 0 ? `ROLLED ${faces[index]}` : 'READY'}
            </span>
          </div>
        ))}
      </div>

      {winnerIndexes.length > 0 && !rolling && (
        <div className={styles.winnerBanner} role="status" aria-live="polite">
          <div className={styles.winnerLabel}>{tied ? `TIE ON ${highestRoll}` : `HIGH ROLLER · ${highestRoll}`}</div>
          <div className={styles.winnerNames}>
            {winnerIndexes.map((index) => (
              <span key={players[index].id} className={styles.winnerName}>{players[index].name}</span>
            ))}
          </div>
        </div>
      )}
      {error && <div className={styles.errorNote} role="alert">{error}</div>}
      <button className={styles.rollBtn} onClick={() => void handleRoll()} disabled={rolling}>
        {rolling ? 'DICE IN THE AIR…' : winnerIndexes.length > 0 ? 'RUN IT BACK ↻' : 'ROLL ALL DICE →'}
      </button>
    </main>
  );
}

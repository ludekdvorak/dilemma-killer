import { useEffect, useRef, useState } from 'react';
import type { Player } from '../../shared/contracts';
import { spinSlots } from '../api';
import { prefersReducedMotion } from '../motion';
import styles from './SlotMachine.module.css';

interface SlotMachineProps {
  players: Player[];
  onBack: () => void;
}

function randomPlayer(players: Player[]): Player {
  return players[Math.floor(Math.random() * players.length)];
}

export default function SlotMachine({ players, onBack }: SlotMachineProps) {
  const [reels, setReels] = useState<Player[]>(() => [
    players[0],
    players[1 % players.length],
    players[2 % players.length],
  ]);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRefs = useRef<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const idleIndexRef = useRef(Math.floor(Math.random() * players.length));
  const lockedReelsRef = useRef(0);

  const clearTimers = () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    timeoutRefs.current.forEach(window.clearTimeout);
    timeoutRefs.current = [];
  };

  useEffect(() => {
    if (spinning || winner) return undefined;
    intervalRef.current = window.setInterval(() => {
      idleIndexRef.current = (idleIndexRef.current + 1) % players.length;
      setReels([
        players[idleIndexRef.current],
        players[(idleIndexRef.current + 1) % players.length],
        players[(idleIndexRef.current + 2) % players.length],
      ]);
    }, prefersReducedMotion() ? 1_500 : 620);
    return () => clearTimers();
  }, [players, spinning, winner]);

  useEffect(() => () => {
    clearTimers();
    controllerRef.current?.abort();
  }, []);

  const handleSpin = async () => {
    if (spinning) return;
    clearTimers();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSpinning(true);
    lockedReelsRef.current = 0;
    setWinner(null);
    setError(null);

    try {
      const result = await spinSlots(players, controller.signal);
      if (controller.signal.aborted) return;
      const reducedMotion = prefersReducedMotion();

      intervalRef.current = window.setInterval(() => {
        setReels(Array.from({ length: 3 }, (_, index) => (
          index < lockedReelsRef.current ? result.winner : randomPlayer(players)
        )));
      }, reducedMotion ? 180 : 72);

      const stopDelays = reducedMotion ? [900, 1_150, 1_400] : [1_950, 2_230, 2_510];
      stopDelays.forEach((delay, reelIndex) => {
        timeoutRefs.current.push(window.setTimeout(() => {
          lockedReelsRef.current = reelIndex + 1;
          setReels((current) => current.map((player, index) => (
            index === reelIndex ? result.winner : player
          )));
          if (reelIndex === 2) {
            if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
            intervalRef.current = null;
            setReels([result.winner, result.winner, result.winner]);
            setWinner(result.winner);
            setSpinning(false);
          }
        }, delay));
      });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'The machine jammed');
      setSpinning(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.title}>WINNER <span>SLOTS</span></h1>
        <p>Three matching names. One guaranteed winner.</p>
      </header>

      <section className={`${styles.machine} ${spinning ? styles.machineSpinning : ''}`}>
        <div className={styles.marquee}>
          <span>★</span> JACKPOT SELECTOR <span>★</span>
        </div>
        <div className={styles.reelWindow}>
          {reels.map((player, index) => (
            <div className={styles.reel} key={index}>
              <span className={styles.reelGlow} />
              <strong key={`${player.id}-${spinning}`} className={styles.reelName}>
                {player.name}
              </strong>
            </div>
          ))}
        </div>
        <div className={styles.machineFooter}>
          <span>PLAYER MATCH</span>
          <div className={styles.lights}>{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
        </div>
        <button
          className={`${styles.lever} ${spinning ? styles.leverPulled : ''}`}
          onClick={() => void handleSpin()}
          disabled={spinning}
          aria-label="Pull the slot-machine lever"
        >
          <span className={styles.leverKnob} />
          <span className={styles.leverArm} />
        </button>
      </section>

      {winner && (
        <div className={styles.winner} role="status" aria-live="polite">
          <span>JACKPOT WINNER</span>
          <strong>{winner.name}</strong>
        </div>
      )}
      {error && <div className={styles.error} role="alert">{error}</div>}
      <button className={styles.spinBtn} onClick={() => void handleSpin()} disabled={spinning}>
        {spinning ? 'NAMES ARE FLYING…' : winner ? 'SPIN AGAIN ↻' : 'PULL TO SPIN →'}
      </button>
    </main>
  );
}

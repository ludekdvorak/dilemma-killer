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
  const leverReturnRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const idleIndexRef = useRef(Math.floor(Math.random() * players.length));
  const lockedReelsRef = useRef(0);
  const leverProgressRef = useRef(0);
  const leverStartYRef = useRef(0);
  const leverDraggedRef = useRef(false);
  const leverDraggingRef = useRef(false);
  const [leverProgress, setLeverProgress] = useState(0);
  const [leverDragging, setLeverDragging] = useState(false);

  const updateLeverProgress = (progress: number) => {
    const next = Math.min(1, Math.max(0, progress));
    leverProgressRef.current = next;
    setLeverProgress(next);
  };

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
    if (leverReturnRef.current !== null) window.clearTimeout(leverReturnRef.current);
    controllerRef.current?.abort();
  }, []);

  const handleSpin = async (pulledByLever = false) => {
    if (spinning) return;
    clearTimers();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSpinning(true);
    lockedReelsRef.current = 0;
    setWinner(null);
    setError(null);
    if (!pulledByLever) updateLeverProgress(1);
    if (leverReturnRef.current !== null) window.clearTimeout(leverReturnRef.current);
    leverReturnRef.current = window.setTimeout(() => {
      updateLeverProgress(0);
      leverReturnRef.current = null;
    }, 520);

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

  const handleLeverPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (spinning) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    leverDraggingRef.current = true;
    leverDraggedRef.current = false;
    leverStartYRef.current = event.clientY;
    setLeverDragging(true);
    updateLeverProgress(0);
  };

  const handleLeverPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!leverDraggingRef.current || spinning) return;
    const distance = Math.max(0, event.clientY - leverStartYRef.current);
    if (distance > 4) leverDraggedRef.current = true;
    updateLeverProgress(distance / 112);
  };

  const finishLeverPull = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!leverDraggingRef.current) return;
    leverDraggingRef.current = false;
    setLeverDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (leverProgressRef.current >= 0.72) {
      updateLeverProgress(1);
      void handleSpin(true);
    } else {
      updateLeverProgress(0);
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
          className={`${styles.lever} ${leverProgress > 0 ? styles.leverPulled : ''} ${leverDragging ? styles.leverDragging : ''}`}
          onPointerDown={handleLeverPointerDown}
          onPointerMove={handleLeverPointerMove}
          onPointerUp={finishLeverPull}
          onPointerCancel={finishLeverPull}
          onClick={() => {
            if (leverDraggedRef.current) {
              leverDraggedRef.current = false;
              return;
            }
            void handleSpin();
          }}
          disabled={spinning}
          aria-label="Pull the slot-machine lever down to spin"
        >
          <span className={styles.leverTrack} />
          <span className={styles.leverArm} />
          <span
            className={styles.leverKnob}
            style={{ transform: `translateY(${leverProgress * 112}px)` }}
          />
          <span className={styles.leverHint}>PULL</span>
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

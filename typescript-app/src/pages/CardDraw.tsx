import { useEffect, useRef, useState } from 'react';
import type { CardResult, Player } from '../../shared/contracts';
import { drawCard } from '../api';
import { prefersReducedMotion } from '../motion';
import styles from './CardDraw.module.css';

interface CardDrawProps {
  players: Player[];
  onBack: () => void;
}

export default function CardDraw({ players, onBack }: CardDrawProps) {
  const [drawing, setDrawing] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState<CardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    requestControllerRef.current?.abort();
  }, []);

  const handleDraw = async () => {
    if (drawing) return;
    setDrawing(true);
    setFlipped(false);
    setError(null);
    setResult(null);
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const drawResult = await drawCard(players, controller.signal);
      if (controller.signal.aborted) return;
      if (prefersReducedMotion()) {
        setResult(drawResult);
        setFlipped(true);
        setDrawing(false);
        return;
      }
      timeoutRef.current = window.setTimeout(() => {
        setResult(drawResult);
        setFlipped(true);
        setDrawing(false);
      }, 400);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Draw failed');
      setDrawing(false);
    }
  };

  const isRed = result?.card.includes('♥') || result?.card.includes('♦');

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
        <h1 className={styles.gameTitle}>CARD DRAW</h1>
      </header>

      <div className={styles.cardWrap}>
        <div className={`${styles.card} ${flipped ? styles.flipped : ''}`}>
          <div className={`${styles.cardFace} ${styles.cardBack}`}>🃏</div>
          <div className={`${styles.cardFace} ${styles.cardFront}`}>
            {result && (
              <span className={`${styles.cardRank} ${isRed ? styles.cardRed : styles.cardBlack}`}>
                {result.card}
              </span>
            )}
          </div>
        </div>
      </div>

      {result && !drawing && (
        <div className={styles.winnerBanner} role="status" aria-live="polite">
          <div className={styles.winnerLabel}>FATE CHOSE</div>
          <div className={styles.winnerName}>{result.winner.name}</div>
        </div>
      )}
      {error && <div className={styles.errorNote} role="alert">{error}</div>}
      <button className={styles.drawBtn} onClick={() => void handleDraw()} disabled={drawing}>
        {drawing ? 'PICKING YOUR FATE…' : result ? 'RUN IT BACK ↻' : 'DRAW YOUR FATE →'}
      </button>
    </main>
  );
}

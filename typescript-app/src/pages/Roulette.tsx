import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Player } from '../../shared/contracts';
import { spinRoulette } from '../api';
import GameAccount from '../components/GameAccount';
import { planRouletteSpin } from '../rouletteSpin';
import styles from './NewGames.module.css';

interface Props { players: Player[]; onBack: () => void; onGoToAuth: () => void }
const SPIN_DURATION_MS = 7_800;
const RED = '#b62e49';
const BLACK = '#18212a';

export default function Roulette({ players, onBack, onGoToAuth }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wheelDegrees, setWheelDegrees] = useState(0);
  const [ballDegrees, setBallDegrees] = useState(0);
  const wheelPosition = useRef(0);
  const ballPosition = useRef(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);

  useEffect(() => () => {
    controller.current?.abort();
    animations.current.forEach((animation) => animation.cancel());
  }, []);

  const segments = players.map((_, index) => {
    const start = index * 100 / players.length;
    const end = (index + 1) * 100 / players.length;
    const divider = Math.min(.35, 6 / players.length);
    return `#d3ab68 ${start}% ${start + divider}%, ${index % 2 === 0 ? RED : BLACK} ${start + divider}% ${end}%`;
  }).join(', ');

  const throwBall = async () => {
    if (busy.current) return;
    busy.current = true;
    setSpinning(true);
    setWinnerIndex(null);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await spinRoulette(players, abort.signal);
      if (abort.signal.aborted) return;
      const wheel = wheelRef.current;
      const ball = ballRef.current;
      if (!wheel || !ball) throw new Error('Roulette table unavailable');
      const startWheel = wheelPosition.current;
      const startBall = ballPosition.current;
      const { wheelEnd, ballEnd } = planRouletteSpin(players.length, result.winnerIndex, startWheel, startBall);
      wheelPosition.current = wheelEnd;
      ballPosition.current = ballEnd;
      setWheelDegrees(wheelEnd);
      setBallDegrees(ballEnd);
      animations.current = [
        wheel.animate([
          { transform: `rotate(${startWheel}deg)` },
          { transform: `rotate(${wheelEnd}deg)` },
        ], { duration: SPIN_DURATION_MS, easing: 'cubic-bezier(.12,.68,.16,1)', fill: 'backwards' }),
        ball.animate([
          { transform: `rotate(${startBall}deg)` },
          { transform: `rotate(${ballEnd}deg)` },
        ], { duration: SPIN_DURATION_MS, easing: 'cubic-bezier(.12,.62,.16,1)', fill: 'backwards' }),
      ];
      await Promise.all(animations.current.map((animation) => animation.finished));
      if (abort.signal.aborted) return;
      animations.current = [];
      setWinnerIndex(result.winnerIndex);
      setSpinning(false);
      busy.current = false;
    } catch (caught) {
      if (abort.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Could not throw the roulette ball');
      setSpinning(false);
      busy.current = false;
    }
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className="game-navigation"><button className={styles.back} onClick={onBack}>← Games</button><GameAccount onGoToAuth={onGoToAuth} /></div>
      <span className={styles.eyebrow}>PREMIUM · RED OR BLACK</span>
      <h1>ROULETTE</h1>
      <p>Every player has an equal pocket. Throw the ball and see whose red or black number it finds.</p>
    </header>
    <section className={styles.panel} aria-label="Roulette table" aria-busy={spinning}>
      <div className={styles.rouletteStatusBar}><span>● ROULETTE TABLE</span><strong>{players.length} PLAYER POCKETS</strong></div>
      <div className={styles.rouletteStage}>
        <div className={styles.rouletteWheel} ref={wheelRef} role="img" aria-label="Red and black roulette wheel with one pocket per player" style={{ '--segments': segments, transform: `rotate(${wheelDegrees}deg)` } as CSSProperties}>
          {players.length <= 16 && players.map((player, index) => {
            const angle = (index + .5) * 360 / players.length;
            return <span key={player.id} className={`${styles.rouletteWheelLabel} ${players.length > 8 ? styles.rouletteWheelLabelCompact : ''}`} style={{ transform: `rotate(${angle}deg) translateY(var(--label-radius)) rotate(${-angle}deg)` }}>
              <b>{index + 1}</b>{players.length <= 8 && <small>{player.name}</small>}
            </span>;
          })}
          <span className={styles.rouletteHub} aria-hidden="true">DK</span>
        </div>
        <div className={styles.rouletteBallOrbit} ref={ballRef} style={{ transform: `rotate(${ballDegrees}deg)` }}>
          <span className={styles.rouletteThrownBall} role="img" aria-label="Roulette ball" />
        </div>
      </div>
      <div className={styles.roulettePlayers} aria-label="Player pockets">
        {players.map((player, index) => <span key={player.id} className={`${styles.roulettePlayer} ${index % 2 === 0 ? styles.rouletteRed : styles.rouletteBlack} ${winnerIndex === index ? styles.rouletteSelected : ''}`}>
          <b>{String(index + 1).padStart(2, '0')}</b><strong>{player.name}</strong><small>{index % 2 === 0 ? 'RED' : 'BLACK'}</small>
        </span>)}
      </div>
    </section>
    <div className={styles.result} role="status" aria-live="polite">{winnerIndex === null ? spinning ? 'The ball is circling the wheel…' : 'Which player pocket will the ball find?' : <><span>BALL LANDED ON {winnerIndex % 2 === 0 ? 'RED' : 'BLACK'} · {String(winnerIndex + 1).padStart(2, '0')}</span><strong>{players[winnerIndex].name}</strong></>}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.action} onClick={() => void throwBall()} disabled={spinning}>{spinning ? 'BALL IS SPINNING…' : winnerIndex === null ? 'THROW THE BALL →' : 'THROW AGAIN ↻'}</button>
  </main>;
}

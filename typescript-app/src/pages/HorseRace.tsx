import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Player, RaceResult } from '../../shared/contracts';
import { raceHorses } from '../api';
import GameAccount from '../components/GameAccount';
import styles from './NewGames.module.css';

interface Props { players: Player[]; onBack: () => void; onGoToAuth: () => void }
const COLORS = ['#f3b54a', '#a287fa', '#51d4d5', '#fc6689', '#b7e66c'];
const RACE_DURATION_MS = 20_000;

export default function HorseRace({ players, onBack, onGoToAuth }: Props) {
  const [racing, setRacing] = useState(false);
  const [order, setOrder] = useState<number[] | null>(null);
  const [progress, setProgress] = useState<number[]>(() => players.map(() => 0));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [commentary, setCommentary] = useState('The horses are at the gate.');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const frame = useRef<number | null>(null);
  const commentaryStage = useRef(-1);

  useEffect(() => () => {
    controller.current?.abort();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const race = async () => {
    if (busy.current) return;
    busy.current = true;
    setRacing(true);
    setOrder(null);
    setProgress(players.map(() => 0));
    setElapsedMs(0);
    setCommentary('And they’re off!');
    commentaryStage.current = -1;
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    let result: RaceResult;
    try {
      result = await raceHorses(players, abort.signal);
    } catch (caught) {
      if (abort.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Could not start the race');
      setRacing(false);
      setCommentary('The race could not start.');
      busy.current = false;
      return;
    }
    if (abort.signal.aborted) return;
    const duration = RACE_DURATION_MS;
    const start = performance.now();
    const ranks = players.map((_, index) => result.finishOrder.indexOf(index));
    let lastPaint = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - start) / duration);
      if (elapsed < 1 && now - lastPaint < 32) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      lastPaint = now;
      setElapsedMs(Math.min(RACE_DURATION_MS, elapsed * RACE_DURATION_MS));
      const positions = players.map((_, index) => {
        const finish = ranks[index] === 0 ? 100 : Math.max(74, 94 - ranks[index] * 2);
        if (elapsed < .8) {
          const cruise = elapsed / .8;
          const surge = Math.sin(elapsed * 42 + index * 2.4) * 4 * Math.sin(Math.PI * cruise);
          return Math.max(0, Math.min(80, 75 * cruise + surge));
        }
        const sprint = (elapsed - .8) / .2;
        const eased = sprint * sprint * (3 - 2 * sprint);
        return 75 + (finish - 75) * eased;
      });
      setProgress(positions);
      const leader = positions.indexOf(Math.max(...positions));
      const stage = [2_000, 5_000, 8_000, 11_000, 14_000, 16_500, 18_500]
        .filter((threshold) => elapsed * duration >= threshold).length;
      if (stage > commentaryStage.current && stage > 0) {
        commentaryStage.current = stage;
        setCommentary([
          '',
          `${players[leader].name} breaks into the lead!`,
          `${players[leader].name} is setting the pace!`,
          'The field is bunching up — anyone could take it!',
          `${players[leader].name} leads by a nose!`,
          'The pack is closing in!',
          'They’re entering the final stretch!',
          'One last push to the line!',
        ][stage]);
      }
      if (elapsed < 1) frame.current = requestAnimationFrame(tick);
      else {
        frame.current = null;
        setOrder(result.finishOrder);
        setCommentary(`${players[result.finishOrder[0]].name} crosses the line first!`);
        setRacing(false);
        busy.current = false;
      }
    };
    frame.current = requestAnimationFrame(tick);
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className="game-navigation"><button className={styles.back} onClick={onBack}>← Games</button><GameAccount onGoToAuth={onGoToAuth} /></div>
      <span className={styles.eyebrow}>PREMIUM · THE FINISH LINE AWAITS</span>
      <h1>HORSE <em>RACING</em></h1>
      <p>One horse per player. Cheer them on and see who crosses first.</p>
    </header>
    <section className={styles.panel} aria-label="Race track" aria-busy={racing}>
      <div className={styles.commentator} role="status" aria-live="polite"><span>🎙 LIVE COMMENTARY</span><strong>{commentary}</strong></div>
      <div className={styles.trackHead}><span>START</span><span>{racing ? `${Math.max(0, Math.ceil((RACE_DURATION_MS - elapsedMs) / 1000))}s TO FINISH` : 'THE TRACK'}</span><span>FINISH 🏁</span></div>
      <div className={styles.lanes}>
        {players.map((player, index) => <div className={`${styles.lane} ${order?.[0] === index ? styles.laneWinner : ''}`} key={player.id} style={{ '--lane-color': COLORS[index % COLORS.length] } as CSSProperties}>
          <div className={styles.laneName}><span>{index + 1}</span><strong>{player.name}</strong></div>
          <div className={styles.track}><div className={styles.horse} style={{ left: `${progress[index]}%` }}><span className={racing ? styles.horseRunning : ''} role="img" aria-label={`${player.name}'s horse`}>🏇</span></div><div className={styles.finishLine} /></div>
          {order?.[0] === index && <span className={styles.winnerBadge}>WINNER</span>}
        </div>)}
      </div>
    </section>
    <div className={styles.result} role="status" aria-live="polite">{order ? <><span>FIRST ACROSS THE LINE</span><strong>{players[order[0]].name}</strong></> : racing ? elapsedMs >= 16_000 ? 'Final stretch—cheer them on!' : 'And they’re off…' : 'The horses are at the gate.'}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.action} onClick={() => void race()} disabled={racing}>{racing ? 'RACE IN PROGRESS…' : order ? 'RACE AGAIN ↻' : 'START THE RACE →'}</button>
  </main>;
}

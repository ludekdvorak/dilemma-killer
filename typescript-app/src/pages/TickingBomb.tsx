import { useEffect, useRef, useState } from 'react';
import type { Player } from '../../shared/contracts';
import { startBomb } from '../api';
import GameAccount from '../components/GameAccount';
import { prefersReducedMotion } from '../motion';
import styles from './NewGames.module.css';

interface Props { players: Player[]; onBack: () => void; onGoToAuth: () => void }
type Phase = 'idle' | 'loading' | 'ticking' | 'exploded';

export default function TickingBomb({ players, onBack, onGoToAuth }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [holder, setHolder] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [fuse, setFuse] = useState(10_000);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const interval = useRef<number | null>(null);
  const deadline = useRef(0);
  const holderRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => () => {
    controller.current?.abort();
    if (interval.current !== null) clearInterval(interval.current);
  }, []);

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('loading');
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await startBomb(players, abort.signal);
      if (abort.signal.aborted) return;
      holderRef.current = result.startingIndex;
      setHolder(result.startingIndex);
      setFuse(result.fuseMs);
      setRemaining(result.fuseMs);
      deadline.current = Date.now() + result.fuseMs;
      setPhase('ticking');
      interval.current = window.setInterval(() => {
        const left = Math.max(0, deadline.current - Date.now());
        setRemaining(left);
        if (left === 0) {
          if (interval.current !== null) clearInterval(interval.current);
          interval.current = null;
          setPhase('exploded');
          busy.current = false;
        }
      }, 50);
    } catch (caught) {
      if (abort.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Could not light the fuse');
      setPhase('idle');
      busy.current = false;
    }
  };

  const pass = () => {
    if (phase !== 'ticking') return;
    if (deadline.current <= Date.now()) {
      setRemaining(0);
      setPhase('exploded');
      busy.current = false;
      return;
    }
    holderRef.current = (holderRef.current + 1) % players.length;
    setHolder(holderRef.current);
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className="game-navigation"><button className={styles.back} onClick={onBack}>← Games</button><GameAccount onGoToAuth={onGoToAuth} /></div>
      <span className={styles.eyebrow}>PREMIUM · PASS IT FAST</span>
      <h1>TICKING <em>BOMB</em></h1>
      <p>Take turns with the button. Whoever holds the bomb when the timer runs out gets picked.</p>
    </header>
    <section className={styles.panel} aria-label="Ticking bomb game">
      <div className={`${styles.bomb} ${phase === 'ticking' && !prefersReducedMotion() ? styles.bombTicking : ''} ${phase === 'exploded' ? styles.bombExploded : ''}`} aria-hidden="true">{phase === 'exploded' ? '💥' : '💣'}</div>
      <div className={styles.timer} aria-live="off">{phase === 'ticking' ? `${(remaining / 1000).toFixed(1)}s` : phase === 'exploded' ? 'BOOM!' : 'READY?'}</div>
      <div className={styles.fuse}><span style={{ width: `${phase === 'ticking' ? remaining / fuse * 100 : phase === 'exploded' ? 0 : 100}%` }} /></div>
      <div className={styles.holder}>{phase === 'idle' ? 'Gather everyone around' : phase === 'loading' ? 'Lighting the fuse…' : <><span>{phase === 'exploded' ? 'CAUGHT WITH THE BOMB' : 'HOLDING THE BOMB'}</span><strong>{players[holder].name}</strong></>}</div>
      <div className={styles.entrants}>{players.map((player, index) => <span key={player.id} className={index === holder && phase !== 'idle' ? styles.chosen : ''}><b>{index + 1}</b>{player.name}</span>)}</div>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {phase === 'ticking' ? <button className={styles.action} onClick={pass}>PASS TO {players[(holder + 1) % players.length].name.toUpperCase()} →</button> : <button className={styles.action} onClick={() => void start()} disabled={phase === 'loading'}>{phase === 'loading' ? 'LIGHTING FUSE…' : phase === 'exploded' ? 'PLAY AGAIN ↻' : 'LIGHT THE FUSE →'}</button>}
    <div className={styles.srResult} role="status" aria-live="polite">{phase === 'exploded' ? `${players[holder].name} was caught with the bomb` : ''}</div>
  </main>;
}

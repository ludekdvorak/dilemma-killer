import { useEffect, useRef, useState } from 'react';
import type { DiceResult, Player } from '../../shared/contracts';
import { rollDice } from '../api';
import Dice3D from '../components/Dice3D';
import GameAccount from '../components/GameAccount';
import styles from './DiceRoll.module.css';

interface DiceRollProps {
  players: Player[];
  onBack: () => void;
  onGoToAuth: () => void;
}

export default function DiceRoll({ players, onBack, onGoToAuth }: DiceRollProps) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'rolling'>('idle');
  const [result, setResult] = useState<DiceResult | null>(null);
  const [rollId, setRollId] = useState(0);
  const [settled, setSettled] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const completed = useRef(new Set<number>());
  const busy = useRef(false);
  const rolling = phase !== 'idle';
  const winners = !rolling ? result?.winnerIndexes ?? [] : [];

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleRoll = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('requesting');
    setSettled([]);
    setError(null);
    completed.current.clear();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const next = await rollDice(players, controller.signal);
      if (controller.signal.aborted) return;
      setResult(next);
      setPhase('rolling');
      setRollId((id) => id + 1);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setResult(null);
      setError(caught instanceof Error ? caught.message : 'Roll failed');
      setPhase('idle');
      busy.current = false;
    }
  };

  const finishDie = (index: number) => {
    completed.current.add(index);
    setSettled((current) => { const next = [...current]; next[index] = true; return next; });
    if (completed.current.size === players.length) {
      setPhase('idle');
      busy.current = false;
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className="game-navigation">
          <button className={styles.backBtn} onClick={onBack}>← Games</button>
          <GameAccount onGoToAuth={onGoToAuth} />
        </div>
        <div className={styles.eyebrow}>LET THE GOOD TIMES ROLL</div>
        <h1 className={styles.gameTitle}>HIGH <span>ROLLERS</span></h1>
        <p className={styles.subtitle}>One die each. Highest roll takes it. All luck, no excuses.</p>
      </header>

      <section className={styles.table} aria-label="Dice table" aria-busy={rolling}>
        <div className={styles.tableHeading}><span>THE DICE TABLE</span><span>● {players.length} PLAYERS</span></div>
        <div className={styles.grid}>
          {players.map((player, index) => {
            const value = result?.rolls[index].roll ?? (index % 6) + 1;
            const showingResult = result && (settled[index] || !rolling);
            return (
              <div key={player.id} className={`${styles.playerDie} ${winners.includes(index) ? styles.winner : ''}`}>
                <span className={styles.playerNumber}>{String(index + 1).padStart(2, '0')}</span>
                <div className={styles.dieStage}>
                  <Dice3D value={value} size={76} shaking={phase === 'requesting'} rollId={rollId}
                    delay={Math.min(index * 160, 800)} onSettled={() => finishDie(index)}
                    label={showingResult ? `${player.name} rolled ${value}` : `${player.name}'s die${rolling ? ' is rolling' : ' is ready'}`} />
                </div>
                <span className={styles.playerName}>{player.name}</span>
                <span className={styles.rollValue}>{showingResult ? `ROLLED ${value}` : rolling ? 'ROLLING…' : 'READY TO ROLL'}</span>
                {winners.includes(index) && <span className={styles.winnerTag}>{winners.length > 1 ? 'TIED' : 'HIGH ROLLER'}</span>}
              </div>
            );
          })}
        </div>
        <div className={styles.tableFooter}>SIX SIDES. ENDLESS POSSIBILITIES.</div>
      </section>

      <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">
        {winners.length > 0 ? <>
          <span className={styles.winnerLabel}>{winners.length > 1 ? `A TIE ON ${result!.rolls[winners[0]].roll}` : 'THE HIGH ROLLER'}</span>
          <h2 className={styles.winnerName}>{winners.map((index) => players[index].name).join(' + ')}</h2>
        </> : <p className={styles.hint}>{rolling ? 'A little suspense. A lot of luck.' : 'The table is yours. Make your move.'}</p>}
      </div>
      {error && <p className={styles.errorNote} role="alert">{error}</p>}
      <button className={styles.rollBtn} onClick={() => void handleRoll()} disabled={rolling}>
        <span className={styles.buttonDie} aria-hidden="true" /> {rolling ? 'ROLLING THE DICE…' : result ? 'ROLL AGAIN' : 'ROLL THE DICE'} <span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}

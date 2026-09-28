import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardResult, Player } from '../../shared/contracts';
import { drawCard } from '../api';
import GameAccount from '../components/GameAccount';
import styles from './CardDraw.module.css';

interface CardDrawProps { players: Player[]; onBack: () => void; onGoToAuth: () => void; }
type Phase = 'idle' | 'shuffling' | 'dealing' | 'revealing' | 'done';

function CardBack() {
  return <div className={styles.backDesign}><span className={styles.backCorner}>✦</span><div className={styles.emblem}><span>DK</span></div><span className={styles.backWordmark}>DILEMMA KILLER</span><span className={styles.backCornerBottom}>✦</span></div>;
}

export default function CardDraw({ players, onBack, onGoToAuth }: CardDrawProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [drawId, setDrawId] = useState(0);
  const [result, setResult] = useState<CardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const drawing = !['idle', 'done'].includes(phase);
  const revealed = phase === 'revealing' || phase === 'done';
  const dealt = phase === 'dealing' || revealed;

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    controllerRef.current?.abort();
  }, []);

  const handleDraw = async () => {
    if (busy.current) return;
    busy.current = true;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setPhase('shuffling');
    setDrawId((id) => id + 1);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    const started = performance.now();
    const after = (delay: number, callback: () => void) => {
      timers.current.push(window.setTimeout(callback, delay));
    };
    try {
      const next = await drawCard(players, controller.signal);
      if (controller.signal.aborted) return;
      setResult(next);
      after(Math.max(0, 1_000 - (performance.now() - started)), () => {
        setPhase('dealing');
        after(800, () => {
          setPhase('revealing');
          after(1_100, () => { setPhase('done'); busy.current = false; });
        });
      });
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Draw failed');
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
        <div className={styles.eyebrow}>A LITTLE MYSTERY. ONE LUCKY PLAYER.</div>
        <h1 className={styles.gameTitle}>DRAW YOUR <span>FATE</span></h1>
        <p className={styles.subtitle}>One card for every player. Draw one name, and that player wins.</p>
      </header>

      <section className={styles.table} aria-label="Card table" aria-busy={drawing}>
        <div className={styles.tableHeading}><span>THE LUCK OF THE DRAW</span><span className={styles.premiumBadge}>FREE TO PLAY</span></div>
        <div className={`${styles.stage} ${phase === 'shuffling' ? styles.shuffling : ''}`}>
          <div className={styles.tableMark} aria-hidden="true">✦</div>
          <div className={styles.deck} aria-hidden="true">
            {[0, 1, 2].map((index) => <div key={index} className={styles.deckCard} style={{ '--card-index': index } as CSSProperties}><CardBack /></div>)}
          </div>
          <div key={drawId} className={`${styles.drawnCard} ${dealt ? styles.dealt : ''}`} role="img"
            aria-label={revealed && result ? `Drawn card: ${result.winner.name} wins` : 'Face-down player card'}>
            <div className={`${styles.card} ${revealed ? styles.flipped : ''}`}>
              <div className={`${styles.cardFace} ${styles.cardBack}`}><CardBack /></div>
              <div className={`${styles.cardFace} ${styles.cardFront}`}>
                <span className={styles.cardStar} aria-hidden="true">✦</span>
                <div className={styles.faceFrame}>
                  <span className={styles.nameLabel}>WINNING CARD</span>
                  <strong className={styles.cardName}>{result?.winner.name ?? 'YOUR NAME'}</strong>
                  <span className={styles.nameRule} aria-hidden="true" />
                  <span className={styles.faceWordmark}>DILEMMA KILLER</span>
                </div>
                <span className={styles.cardStarBottom} aria-hidden="true">✦</span>
              </div>
            </div>
          </div>
          <span className={styles.deckCaption}>THE DECK</span>
          <span className={`${styles.drawCaption} ${dealt ? styles.captionVisible : ''}`}>{phase === 'done' ? 'YOUR FATE' : 'THE REVEAL'}</span>
        </div>
        <div className={styles.players} aria-label="Players in this draw">
          {players.map((player, index) => <span key={player.id} className={`${styles.player} ${phase === 'done' && index === result?.winnerIndex ? styles.selectedPlayer : ''}`}>
            <span className={styles.playerDot} />{player.name}
          </span>)}
        </div>
      </section>

      <div className={styles.result} role="status" aria-live="polite" aria-atomic="true">
        {phase === 'done' && result ? <>
          <span className={styles.winnerLabel}>THE DRAWN NAME WINS</span>
          <h2 className={styles.winnerName}>{result.winner.name}</h2>
        </> : <p className={styles.hint}>{drawing ? 'Finding the winning name…' : 'Every player has a card in the deck.'}</p>}
      </div>
      {error && <p className={styles.errorNote} role="alert">{error}</p>}
      <button className={styles.drawBtn} onClick={() => void handleDraw()} disabled={drawing}>
        <span aria-hidden="true">♠</span> {drawing ? 'DRAWING YOUR FATE…' : phase === 'done' ? 'DRAW AGAIN' : 'DRAW A CARD'} <span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}

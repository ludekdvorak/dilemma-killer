import { useEffect, useRef, useState } from 'react';
import type { Player, SpinResult } from '../../shared/contracts';
import { ApiRequestError, spinWheel } from '../api';
import { prefersReducedMotion } from '../motion';
import styles from './LuckyWheel.module.css';

const SEGMENT_COLORS = [
  '#ff6b35', '#ffd166', '#06d6a0', '#118ab2',
  '#e040fb', '#ff4081', '#69f0ae', '#ffab40',
  '#40c4ff', '#ff6d00', '#b2ff59', '#ea80fc',
];

interface LuckyWheelProps {
  players: Player[];
  onBack: () => void;
}

function drawWheel(canvas: HTMLCanvasElement, players: Player[], rotationAngle: number): void {
  const context = canvas.getContext('2d');
  if (!context || players.length === 0) return;

  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 8;
  const arc = (2 * Math.PI) / players.length;
  context.clearRect(0, 0, size, size);

  context.save();
  context.shadowColor = 'rgba(255,107,53,0.3)';
  context.shadowBlur = 40;
  context.beginPath();
  context.arc(center, center, radius, 0, 2 * Math.PI);
  context.fillStyle = '#1c1c28';
  context.fill();
  context.restore();

  players.forEach((player, index) => {
    const startAngle = rotationAngle + index * arc - Math.PI / 2;
    const endAngle = startAngle + arc;
    const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, startAngle, endAngle);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = '#0a0a0f';
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.translate(center, center);
    context.rotate(startAngle + arc / 2);
    context.textAlign = 'right';
    context.fillStyle = 'rgba(0,0,0,0.85)';
    context.font = `bold ${Math.min(16, Math.floor(radius * 0.15))}px 'DM Sans', sans-serif`;
    const label = player.name.length > 10 ? `${player.name.slice(0, 9)}…` : player.name;
    context.fillText(label, radius - 14, 5);
    context.restore();
  });

  context.beginPath();
  context.arc(center, center, 22, 0, 2 * Math.PI);
  context.fillStyle = '#0a0a0f';
  context.fill();
  context.strokeStyle = '#2a2a3d';
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.arc(center, center, 8, 0, 2 * Math.PI);
  context.fillStyle = '#ff6b35';
  context.fill();
}

function localSpin(players: Player[]): SpinResult {
  const winnerIndex = Math.floor(Math.random() * players.length);
  const segment = 360 / players.length;
  const fullTurns = (5 + Math.floor(Math.random() * 5)) * 360;
  const target = 360 - (winnerIndex * segment + segment / 2);
  return {
    winner: players[winnerIndex],
    winnerIndex,
    rotationDegrees: fullTurns + ((target % 360) + 360) % 360,
  };
}

export default function LuckyWheel({ players, onBack }: LuckyWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current, players, currentAngle);
  }, [currentAngle, players]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    requestControllerRef.current?.abort();
  }, []);

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    setError(null);
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    let result: SpinResult;
    try {
      result = await spinWheel(players, controller.signal);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof ApiRequestError && caught.status !== undefined) {
        setError(caught.message);
        setSpinning(false);
        return;
      }
      result = localSpin(players);
      setError('Server unavailable — using a local result. This play will not be counted.');
    }

    const startAngle = currentAngle;
    const currentDegrees = ((startAngle * 180 / Math.PI) % 360 + 360) % 360;
    const finalDegrees = ((result.rotationDegrees % 360) + 360) % 360;
    const alignmentDegrees = (finalDegrees - currentDegrees + 360) % 360;
    const fullTurns = Math.max(5, Math.floor(result.rotationDegrees / 360)) * 360;
    const endAngle = startAngle + (fullTurns + alignmentDegrees) * Math.PI / 180;
    if (prefersReducedMotion()) {
      setCurrentAngle(endAngle % (2 * Math.PI));
      setSpinning(false);
      setWinner(result.winner);
      return;
    }
    const duration = 4500;
    const startTime = performance.now();
    const easeOut = (progress: number) => 1 - Math.pow(1 - progress, 4);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      setCurrentAngle(startAngle + (endAngle - startAngle) * easeOut(progress));
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentAngle(endAngle % (2 * Math.PI));
        setSpinning(false);
        setWinner(result.winner);
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>⚔️ DILEMMA KILLER</div>
        <h1 className={styles.gameTitle}>LUCKY WHEEL</h1>
        <div className={styles.playerPills}>
          {players.slice(0, 5).map((player, index) => (
            <span
              key={player.id}
              className={styles.pill}
              style={{
                background: `${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}25`,
                borderColor: `${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}55`,
                color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
              }}
            >
              {player.name}
            </span>
          ))}
          {players.length > 5 && <span className={styles.pillMore}>+{players.length - 5}</span>}
        </div>
      </header>

      <div className={styles.wheelWrap}>
        <div className={styles.pointer}>▼</div>
        <canvas
          ref={canvasRef}
          width={420}
          height={420}
          className={styles.canvas}
          role="img"
          aria-label="Wheel containing all players"
        />
      </div>

      {winner && !spinning && (
        <div className={styles.winnerBanner} role="status" aria-live="polite">
          <div className={styles.winnerLabel}>WINNER</div>
          <div className={styles.winnerName}>{winner.name}</div>
          <div className={styles.confetti}>🎉</div>
        </div>
      )}
      {error && <div className={styles.errorNote} role="alert">{error}</div>}
      <button
        className={`${styles.spinBtn} ${spinning ? styles.spinning : ''}`}
        onClick={() => void handleSpin()}
        disabled={spinning}
      >
        {spinning ? 'SPINNING…' : winner ? 'SPIN AGAIN' : 'SPIN!'}
      </button>
    </main>
  );
}

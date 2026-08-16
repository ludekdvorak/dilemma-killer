import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Player, SpinResult } from '../../shared/contracts';
import { ApiRequestError, spinWheel } from '../api';
import styles from './LuckyWheel.module.css';

const SEGMENT_COLORS = [
  '#8b5cf6', '#22d3ee', '#ff3d81', '#c4ff4d',
  '#a855f7', '#38bdf8', '#fb7185', '#facc15',
  '#6366f1', '#06b6d4', '#ec4899', '#84cc16',
];

interface LuckyWheelProps {
  players: Player[];
  onBack: () => void;
}

type WinnerStyle = CSSProperties & {
  '--winner-color': string;
  '--winner-color-soft': string;
};

function drawWheel(canvas: HTMLCanvasElement, players: Player[], rotationAngle: number): void {
  const context = canvas.getContext('2d');
  if (!context || players.length === 0) return;

  const size = canvas.width;
  const center = size / 2;
  const radius = size / 2 - 8;
  const arc = (2 * Math.PI) / players.length;
  context.clearRect(0, 0, size, size);

  context.save();
  context.shadowColor = 'rgba(139,92,246,0.4)';
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
  context.fillStyle = '#8b5cf6';
  context.fill();
}

function localSpin(players: Player[]): SpinResult {
  const winnerIndex = Math.floor(Math.random() * players.length);
  const segment = 360 / players.length;
  const fullTurns = (16 + Math.floor(Math.random() * 16)) * 360;
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
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current, players, angleRef.current);
  }, [players]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    requestControllerRef.current?.abort();
  }, []);

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);
    setWinnerIndex(null);
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

    const startAngle = angleRef.current;
    const currentDegrees = ((startAngle * 180 / Math.PI) % 360 + 360) % 360;
    const finalDegrees = ((result.rotationDegrees % 360) + 360) % 360;
    const alignmentDegrees = (finalDegrees - currentDegrees + 360) % 360;
    // Keep nearly the same rotation rate while shortening the overall spin.
    const fullTurns = 5 * 360;
    const endAngle = startAngle + (fullTurns + alignmentDegrees) * Math.PI / 180;
    const duration = 8000;
    const startTime = performance.now();
    const easeOut = (progress: number) => 1 - Math.pow(1 - progress, 4);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const angle = startAngle + (endAngle - startAngle) * easeOut(progress);
      angleRef.current = angle;
      if (canvasRef.current) drawWheel(canvasRef.current, players, angle);
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        angleRef.current = endAngle % (2 * Math.PI);
        if (canvasRef.current) drawWheel(canvasRef.current, players, angleRef.current);
        animationFrameRef.current = null;
        setSpinning(false);
        setWinner(result.winner);
        setWinnerIndex(result.winnerIndex);
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>← Back</button>
        <div className={styles.logo}>🎮 DILEMMA KILLER</div>
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

      {winner && winnerIndex !== null && !spinning && (
        <div
          className={styles.winnerBanner}
          role="status"
          aria-live="polite"
          style={{
            '--winner-color': SEGMENT_COLORS[winnerIndex % SEGMENT_COLORS.length],
            '--winner-color-soft': `${SEGMENT_COLORS[winnerIndex % SEGMENT_COLORS.length]}66`,
          } as WinnerStyle}
        >
          <div className={styles.winnerLabel}>THE WHEEL HAS SPOKEN</div>
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
        {spinning ? 'FATE IS DECIDING…' : winner ? 'RUN IT BACK ↻' : 'SPIN THE WHEEL →'}
      </button>
    </main>
  );
}

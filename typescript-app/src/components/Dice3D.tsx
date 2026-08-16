import type { CSSProperties } from 'react';
import styles from './Dice3D.module.css';

const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const ROTATIONS = [
  '',
  'rotateX(0deg) rotateY(0deg)',
  'rotateX(-90deg) rotateY(0deg)',
  'rotateX(0deg) rotateY(-90deg)',
  'rotateX(0deg) rotateY(90deg)',
  'rotateX(90deg) rotateY(0deg)',
  'rotateX(0deg) rotateY(180deg)',
] as const;

type DieStyle = CSSProperties & {
  '--die-size': string;
  '--die-rotation': string;
};

interface Dice3DProps {
  value?: number;
  size?: number;
  rolling?: boolean;
  floating?: boolean;
  label?: string;
}

export default function Dice3D({
  value = 5,
  size = 72,
  rolling = false,
  floating = false,
  label,
}: Dice3DProps) {
  const safeValue = Math.min(6, Math.max(1, Math.round(value)));
  return (
    <div
      className={`${styles.scene} ${floating ? styles.floating : ''}`}
      style={{
        '--die-size': `${size}px`,
        '--die-rotation': ROTATIONS[safeValue],
      } as DieStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className={`${styles.cube} ${rolling ? styles.rolling : ''}`}>
        {[1, 6, 3, 4, 2, 5].map((face) => (
          <div key={face} className={`${styles.face} ${styles[`face${face}`]}`}>
            {Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                className={PIPS[face].includes(index + 1) ? styles.pip : styles.pipEmpty}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

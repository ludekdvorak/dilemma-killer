import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import styles from './Dice3D.module.css';

const PIPS: Record<number, number[]> = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
};
// Orient the result face upward, as on a real die resting on the table.
const ROTATIONS: [number, number][] = [[0, 0], [90, 0], [0, 0], [90, -90], [90, 90], [180, 0], [90, 180]];
const orientation = (x: number, y: number, z = 0) => `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;

type DieStyle = CSSProperties & { '--die-size': string; '--die-rotation': string };
interface Dice3DProps {
  value?: number;
  size?: number;
  floating?: boolean;
  animate?: boolean;
  shaking?: boolean;
  rollId?: number;
  delay?: number;
  onSettled?: () => void;
  label?: string;
}

export default function Dice3D({
  value = 5, size = 72, floating = false, animate = true, shaking = false,
  rollId = 0, delay = 0, onSettled, label,
}: Dice3DProps) {
  const safeValue = Math.min(6, Math.max(1, Math.round(value)));
  const cube = useRef<HTMLDivElement>(null);
  const flight = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const previous = useRef(ROTATIONS[safeValue]);
  const completedRoll = useRef(0);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useLayoutEffect(() => {
    if (!rollId || completedRoll.current === rollId) {
      previous.current = ROTATIONS[safeValue];
      return;
    }
    if (!cube.current || !flight.current || !shadow.current) return;
    const [targetX, targetY] = ROTATIONS[safeValue];
    const [startX, startY] = previous.current;
    previous.current = [targetX, targetY];
    if (!animate) {
      completedRoll.current = rollId;
      settled.current?.();
      return;
    }

    const endX = targetX + 1080;
    const endY = targetY + (Math.random() > .5 ? 1080 : -1080);
    const direction = Math.random() > .5 ? 1 : -1;
    const duration = 5_000 + Math.random() * 250;
    const timing: KeyframeAnimationOptions = { duration, delay, fill: 'backwards', easing: 'linear' };
    const rotations = cube.current.animate([
      { transform: orientation(startX, startY), offset: 0 },
      { transform: orientation(endX * .48, endY * .48, 32 * direction), offset: .32 },
      { transform: orientation(endX * .72, endY * .72, -18 * direction), offset: .52 },
      { transform: orientation(endX - 50, endY - 28 * direction, 10 * direction), offset: .7 },
      { transform: orientation(endX + 12, endY + 6 * direction, -4 * direction), offset: .84 },
      { transform: orientation(endX - 4, endY, 2 * direction), offset: .93 },
      { transform: orientation(endX, endY), offset: 1 },
    ], timing);
    const movement = flight.current.animate([
      { transform: 'translate3d(0,0,0)', offset: 0 },
      { transform: `translate3d(${-38 * direction}px,-80px,24px)`, offset: .2, easing: 'ease-in' },
      { transform: `translate3d(${25 * direction}px,6px,0)`, offset: .42, easing: 'ease-out' },
      { transform: `translate3d(${14 * direction}px,-35px,10px)`, offset: .56, easing: 'ease-in' },
      { transform: `translate3d(${-11 * direction}px,4px,0)`, offset: .7, easing: 'ease-out' },
      { transform: `translate3d(${-5 * direction}px,-9px,0)`, offset: .77, easing: 'ease-in' },
      { transform: `translate3d(${3 * direction}px,2px,0)`, offset: .86 },
      { transform: 'translate3d(0,0,0)', offset: 1 },
    ], timing);
    const shade = shadow.current.animate([
      { transform: 'scale(1)', opacity: .65, offset: 0 },
      { transform: 'scale(.6)', opacity: .2, offset: .18 },
      { transform: 'scale(1.15)', opacity: .8, offset: .38 },
      { transform: 'scale(.8)', opacity: .35, offset: .51 },
      { transform: 'scale(1.05)', opacity: .7, offset: .67 },
      { transform: 'scale(.9)', opacity: .5, offset: .77 },
      { transform: 'scale(1)', opacity: .65, offset: 1 },
    ], timing);
    let cancelled = false;
    void Promise.all([rotations.finished, movement.finished, shade.finished])
      .then(() => {
        if (!cancelled) {
          completedRoll.current = rollId;
          settled.current?.();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      rotations.cancel(); movement.cancel(); shade.cancel();
    };
  }, [rollId, safeValue, delay, animate]);

  return (
    <div
      className={`${styles.scene} ${animate ? styles.animated : ''} ${floating ? styles.floating : ''} ${shaking ? styles.shaking : ''}`}
      style={{ '--die-size': `${size}px`, '--die-rotation': orientation(...ROTATIONS[safeValue]) } as DieStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className={styles.shadow} ref={shadow} />
      <div className={styles.flight} ref={flight}>
        <div className={styles.view}>
          <div className={styles.cube} ref={cube}>
            {[1, 6, 3, 4, 2, 5].map((face) => (
              <div key={face} className={`${styles.face} ${styles[`face${face}`]}`}>
                {Array.from({ length: 9 }, (_, index) => (
                  <span key={index} className={PIPS[face].includes(index + 1) ? styles.pip : styles.pipEmpty} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

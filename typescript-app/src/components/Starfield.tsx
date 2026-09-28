import { useEffect, useRef } from 'react';
import styles from './Starfield.module.css';

interface Star {
  x: number;
  y: number;
  z: number;
  previousZ: number;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let depth = Math.max(width, height);
    let animationFrame = 0;
    let previousTime = performance.now();
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stars: Star[] = [];

    const resetStar = (star: Star, randomDepth = false) => {
      star.x = (Math.random() - 0.5) * width * 1.8;
      star.y = (Math.random() - 0.5) * height * 1.8;
      star.z = randomDepth ? Math.random() * depth + 1 : depth;
      star.previousZ = star.z + 12;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      depth = Math.max(width, height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      stars.forEach((star) => resetStar(star, true));
    };

    for (let index = 0; index < (width < 600 ? 60 : 110); index += 1) {
      const star = { x: 0, y: 0, z: 1, previousZ: 1 };
      resetStar(star, true);
      stars.push(star);
    }
    resize();

    const draw = (now: number) => {
      if (document.hidden) return;
      const reducedMotion = motionPreference.matches;
      if (!reducedMotion && now - previousTime < 32) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }
      const frameScale = Math.min((now - previousTime) / 16.67, 2.5);
      previousTime = now;
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';

      for (const star of stars) {
        star.previousZ = star.z + (reducedMotion ? 2 : 0);
        if (!reducedMotion) star.z -= 4.6 * frameScale;
        if (star.z <= 1) resetStar(star);

        const x = (star.x / star.z) * depth + width / 2;
        const y = (star.y / star.z) * depth + height / 2;
        const previousX = (star.x / star.previousZ) * depth + width / 2;
        const previousY = (star.y / star.previousZ) * depth + height / 2;

        if (x < -80 || x > width + 80 || y < -80 || y > height + 80) {
          resetStar(star);
          continue;
        }

        const proximity = 1 - star.z / depth;
        const blue = Math.round(220 + proximity * 35);
        context.strokeStyle = `rgba(175, ${blue}, 255, ${0.2 + proximity * 0.8})`;
        context.lineWidth = 0.7 + proximity * 2.2;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(x, y);
        context.stroke();
      }

      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    const restart = () => {
      window.cancelAnimationFrame(animationFrame);
      previousTime = performance.now() - 33;
      if (!document.hidden) animationFrame = window.requestAnimationFrame(draw);
    };
    const onResize = () => { resize(); restart(); };
    restart();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', restart);
    motionPreference.addEventListener('change', restart);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', restart);
      motionPreference.removeEventListener('change', restart);
    };
  }, []);

  return (
    <div className={styles.space} aria-hidden="true">
      <div className={styles.nebula} />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}

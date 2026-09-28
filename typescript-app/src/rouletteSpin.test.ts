import { describe, expect, it } from 'vitest';
import { planRouletteSpin } from './rouletteSpin';

const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

describe('roulette ball alignment', () => {
  it.each([2, 3, 8, 50])('lands on the selected pocket for %i players, including repeat spins', (count) => {
    let wheel = 0;
    let ball = 0;
    for (const winnerIndex of [count - 1, 0, Math.floor(count / 2)]) {
      const next = planRouletteSpin(count, winnerIndex, wheel, ball, () => .37);
      expect(normalize(next.ballEnd)).toBeCloseTo(
        normalize(next.wheelEnd + (winnerIndex + .5) * 360 / count),
        8,
      );
      expect(next.wheelEnd - wheel).toBeGreaterThan(6 * 360);
      expect(ball - next.ballEnd).toBeGreaterThanOrEqual(8 * 360);
      wheel = next.wheelEnd;
      ball = next.ballEnd;
    }
  });
});

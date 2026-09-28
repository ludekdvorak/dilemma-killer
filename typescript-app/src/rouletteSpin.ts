function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function planRouletteSpin(
  playerCount: number,
  winnerIndex: number,
  currentWheel: number,
  currentBall: number,
  random: () => number = Math.random,
) {
  const wheelEnd = currentWheel + 6 * 360 + random() * 360;
  const pocketCenter = (winnerIndex + .5) * 360 / playerCount;
  const landingAngle = normalize(pocketCenter + wheelEnd);
  const backwardGap = normalize(currentBall - landingAngle);
  const ballEnd = currentBall - 8 * 360 - backwardGap;
  return { wheelEnd, ballEnd };
}

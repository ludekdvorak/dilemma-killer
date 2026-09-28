import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { message: 'Guest' } }));
  await page.route('**/api/games/dice/roll', (route) => {
    const players = route.request().postDataJSON() as { id: string; name: string }[];
    return route.fulfill({ json: {
      rolls: players.map((player, index) => ({ player, roll: index === 0 ? 6 : 2 })),
      winners: [players[0]], winnerIndexes: [0],
    } });
  });
});

test('the default dice roll animates and can be repeated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('switch', { name: 'Dice animations' })).toHaveCount(0);
  await page.getByRole('button', { name: /LET.S PLAY/ }).click();
  await page.getByRole('button', { name: /Dice Roll/ }).click();
  for (let round = 0; round < 2; round++) {
    await page.getByRole('button', { name: round ? /ROLL AGAIN/ : /ROLL THE DICE/ }).click();
    const started = Date.now();
    const die = page.getByRole('img', { name: "Player 1's die is rolling" });
    await expect.poll(() => die.evaluate((element) => element.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running').length)).toBeGreaterThan(0);
    const position = () => die.locator('div').first().evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
    const before = await position();
    await page.waitForTimeout(500);
    const after = await position();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(3);
    await expect(page.getByRole('button', { name: /ROLL AGAIN/ })).toBeEnabled({ timeout: 10_000 });
    expect(Date.now() - started).toBeGreaterThan(4_500);
    await expect(page.getByRole('img', { name: 'Player 1 rolled 6' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Player 1', exact: true })).toBeVisible();
  }
});

test('a reduced-motion system still shows the full dice throw', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /LET.S PLAY/ }).click();
  await page.getByRole('button', { name: /Dice Roll/ }).click();
  await page.getByRole('button', { name: /ROLL THE DICE/ }).click();
  const die = page.getByRole('img', { name: "Player 1's die is rolling" });
  await expect.poll(() => die.evaluate((element) => element.getAnimations({ subtree: true })
    .filter((animation) => animation.playState === 'running').length)).toBeGreaterThan(0);
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('button', { name: /ROLLING THE DICE/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /ROLL AGAIN/ })).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByRole('img', { name: 'Player 1 rolled 6' })).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

const players = [{ id: '1', name: 'Player 1' }, { id: '2', name: 'Player 2' }];

async function openMenu(page: Page) {
  await page.getByRole('button', { name: /LET.S PLAY/ }).click();
}

async function mockPremiumAccount(page: Page) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: {
    email: 'premium@example.com', displayName: 'Premium Tester', premium: true, premiumExpiresAt: null, hasPassword: true,
  } }));
  await page.route('**/api/players', (route) => route.fulfill({ json: route.request().method() === 'POST'
    ? { id: 100, name: (route.request().postDataJSON() as { name: string }).name }
    : [] }));
  await page.route('**/api/groups', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/statistics', (route) => route.fulfill({ json: {
    totalPlays: 0, byGame: { wheel: 0, dice: 0, slots: 0, cards: 0, roulette: 0, horserace: 0, bomb: 0 },
    favoriteGame: null, lastPlayedAt: null, memberSince: new Date().toISOString(),
  } }));
}

test('guests can draw cards and see only the three paid games locked', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { message: 'Guest' } }));
  await page.route('**/api/games/cards/draw', (route) => route.fulfill({ json: { winner: players[1], winnerIndex: 1 } }));
  await page.goto('/');
  await openMenu(page);
  await expect(page.getByRole('button', { name: /Card Draw/ })).toBeEnabled();
  for (const name of ['Roulette', 'Horse Racing', 'Ticking Bomb']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('PREMIUM');
  }
  await page.getByRole('button', { name: /Card Draw/ }).click();
  await page.getByRole('button', { name: /DRAW A CARD/ }).click();
  await expect(page.getByRole('button', { name: /DRAWING YOUR FATE/ })).toBeDisabled();
  await page.waitForTimeout(350);
  await expect(page.getByRole('heading', { name: 'Player 2' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Player 2' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Drawn card: Player 2 wins' })).toContainText('Player 2');
  const flipDuration = await page.getByRole('img', { name: 'Drawn card: Player 2 wins' })
    .locator('div').first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(flipDuration).toBe('0.9s');
});

test('guests see the full Lucky Wheel spin and can complete Winner Slots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { message: 'Guest' } }));
  await page.route('**/api/wheel/spin', (route) => route.fulfill({ json: {
    winner: players[0], winnerIndex: 0, rotationDegrees: 1890,
  } }));
  await page.route('**/api/games/slots/spin', (route) => route.fulfill({ json: {
    winner: players[1], winnerIndex: 1,
  } }));
  await page.goto('/');
  await openMenu(page);
  await page.getByRole('button', { name: /Lucky Wheel/ }).click();
  await page.getByRole('button', { name: /SPIN THE WHEEL/ }).click();
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('button', { name: /FATE IS DECIDING/ })).toBeDisabled();
  await expect(page.getByText('THE WHEEL HAS SPOKEN')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: /Winner Slots/ }).click();
  await page.getByRole('button', { name: /PULL TO SPIN/ }).click();
  await expect(page.getByText('JACKPOT WINNER')).toBeVisible();
});

test('premium roulette and bomb complete a round with reduced system motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPremiumAccount(page);
  await page.route('**/api/games/roulette/spin', (route) => route.fulfill({ json: {
    winner: players[1], winnerIndex: 1,
  } }));
  await page.route('**/api/games/bomb/start', (route) => route.fulfill({ json: {
    startingIndex: 0, fuseMs: 400,
  } }));
  await page.goto('/');
  await openMenu(page);

  await page.getByRole('button', { name: /Roulette/ }).click();
  await page.getByRole('button', { name: /THROW THE BALL/ }).click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('button', { name: /BALL IS SPINNING/ })).toBeDisabled();
  await expect(page.getByText(/BALL LANDED ON BLACK/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Games/ }).click();

  await page.getByRole('button', { name: /Ticking Bomb/ }).click();
  await page.getByRole('button', { name: /LIGHT THE FUSE/ }).click();
  await page.getByRole('button', { name: /PASS TO PLAYER 2/ }).click();
  await expect(page.getByText('CAUGHT WITH THE BOMB', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').last()).toContainText('Player 2 was caught with the bomb');
});

test('the game menu and race fit a narrow phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPremiumAccount(page);
  await page.route('**/api/games/horserace/race', (route) => route.fulfill({ json: {
    winner: players[0], winnerIndex: 0, finishOrder: [0, 1],
  } }));
  await page.goto('/');
  await openMenu(page);
  await expect(page.getByRole('button', { name: /Horse Racing/ })).toBeVisible();
  await page.getByRole('button', { name: /Horse Racing/ }).click();
  await page.getByRole('button', { name: /START THE RACE/ }).click();
  await expect(page.getByRole('button', { name: /RACE IN PROGRESS/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('roulette ball lands on the selected red or black player pocket', async ({ page }) => {
  await mockPremiumAccount(page);
  await page.route('**/api/games/roulette/spin', (route) => route.fulfill({ json: {
    winner: { id: '100', name: 'Player 3' }, winnerIndex: 2,
  } }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Player name' }).fill('Player 3');
  await page.getByRole('button', { name: 'Add player' }).click();
  await openMenu(page);
  await page.getByRole('button', { name: /Roulette/ }).click();
  await expect(page.getByRole('img', { name: /Red and black roulette wheel/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Roulette ball' })).toBeVisible();
  await page.getByRole('button', { name: /THROW THE BALL/ }).click();
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('button', { name: /BALL IS SPINNING/ })).toBeDisabled();
  await expect(page.getByText(/BALL LANDED ON RED/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('status').last()).toContainText('Player 3');
  await expect(page.getByLabel('Player pockets')).toContainText('Player 3');
  const wheel = page.getByRole('img', { name: /Red and black roulette wheel/ });
  const orbit = page.getByRole('img', { name: 'Roulette ball' }).locator('..');
  const [wheelAngle, ballAngle] = await Promise.all([wheel, orbit].map((locator) => locator.evaluate((node) => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform);
    return (Math.atan2(matrix.b, matrix.a) * 180 / Math.PI + 360) % 360;
  })));
  const distance = Math.abs(((ballAngle - wheelAngle - 300 + 540) % 360) - 180);
  expect(distance).toBeLessThan(2);
});

test('horse racing takes about 20 seconds even with reduced system motion', async ({ page }) => {
  test.setTimeout(40_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPremiumAccount(page);
  await page.route('**/api/games/horserace/race', (route) => route.fulfill({ json: {
    winner: players[0], winnerIndex: 0, finishOrder: [0, 1],
  } }));
  await page.goto('/');
  await openMenu(page);
  await page.getByRole('button', { name: /Horse Racing/ }).click();
  const started = Date.now();
  await page.getByRole('button', { name: /START THE RACE/ }).click();
  await expect(page.getByText(/\d+s TO FINISH/)).toBeVisible();
  await expect(page.getByText('🎙 LIVE COMMENTARY')).toBeVisible();
  await expect(page.getByRole('img', { name: "Player 1's horse" })).toBeVisible();
  await page.waitForTimeout(5_000);
  await expect(page.getByText(/breaks into the lead|setting the pace/)).toBeVisible();
  await expect(page.getByRole('button', { name: /RACE IN PROGRESS/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /RACE AGAIN/ })).toBeEnabled({ timeout: 25_000 });
  expect(Date.now() - started).toBeGreaterThan(18_000);
  await expect(page.getByText('FIRST ACROSS THE LINE')).toBeVisible();
  await expect(page.getByText('Player 1 crosses the line first!')).toBeVisible();
});

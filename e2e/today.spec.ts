import { expect, test, type Page } from '@playwright/test';

/** Today: the creator's own work first, then what's next. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('memories bring back posted work, lead with "on this day", rotate, and open the original', async ({ page }) => {
  await open(page, '/');
  const memory = page.getByRole('region', { name: 'Carry-on packing list' });
  await expect(memory).toContainText('On this day · 1 year ago');
  await expect(memory).toContainText('Everything in one carry-on');

  // Rotate through every memory; one of them is a playable video.
  const next = page.getByRole('button', { name: /Another memory/ });
  await expect(next).toContainText('1 of 3');
  const titles = new Set<string>();
  let sawVideo = false;
  for (let i = 0; i < 3; i++) {
    const region = page.locator('section.memory');
    titles.add((await region.locator('.memory__title').textContent()) ?? '');
    if (await region.locator('video[controls]').count()) sawVideo = true;
    await next.click();
  }
  expect(titles.size).toBe(3);
  expect(sawVideo).toBe(true);
  await expect(next).toContainText('1 of 3');

  await page.locator('section.memory').getByRole('link', { name: /Open creation/ }).click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-atlas-packing$/);
  await expect(page.locator('.creation__info')).toContainText('Posted');
});

test('look what you’ve made shows posted work first and opens each creation', async ({ page }) => {
  await open(page, '/');
  const film = page.locator('.t-film');
  const tiles = film.locator('.t-film__tile');
  await expect(tiles).toHaveCount(4);
  await expect(tiles.first().locator('.t-film__badge')).toHaveText('Posted');
  await tiles.first().click();
  await expect(page).toHaveURL(/\/gallery\/v-/);
});

test('next action, quick actions and the work list stay one click away', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('link', { name: /Continue “Five phrases for a night market”/ })).toBeVisible();
  await page.getByRole('group', { name: 'Quick actions' }).getByRole('button', { name: 'New idea' }).click();
  await expect(page.getByRole('dialog', { name: 'Capture an idea' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: /Start something new/ }).click();
  await expect(page.getByRole('dialog', { name: 'Capture an idea' })).toBeVisible();
});

test('a personal photo is optional, kept in this browser, and per person', async ({ page }) => {
  await open(page, '/');
  const photoBtn = page.getByRole('button', { name: 'Add a photo of you' });
  await expect(photoBtn).toContainText('R');
  await photoBtn.click();
  await expect(page.getByText('Preview: kept in this browser only, never uploaded.')).toBeVisible();
  await page.getByTestId('personal-photo-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  const changeBtn = page.getByRole('button', { name: 'Change your photo' });
  await expect(changeBtn.locator('img')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Change your photo' }).locator('img')).toBeVisible();

  // Previewing as a collaborator never shows the owner's photo.
  await page.goto('/team?instant');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sam');
  await expect(page.getByRole('button', { name: 'Add a photo of you' })).toBeVisible();
  await expect(page.locator('.pphoto img')).toHaveCount(0);

  // Sam has nothing posted he can open: an honest empty memory, no owner work.
  await expect(page.getByRole('heading', { name: 'Your posted work comes back here' })).toBeVisible();
  await expect(page.locator('.t-film__tile')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to your view' }).click();

  await page.goto('/?instant');
  await page.getByRole('button', { name: 'Change your photo' }).click();
  await page.getByRole('menuitem', { name: 'Remove photo' }).click();
  await expect(page.getByRole('button', { name: 'Add a photo of you' })).toBeVisible();
});

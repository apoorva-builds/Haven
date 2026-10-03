import { expect, test, type Page } from '@playwright/test';

/** Today: the creator's own work first, then what's next. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('memories bring back posted work, lead with "on this day", rotate, and open the original', async ({ page }) => {
  await open(page, '/');
  const memory = page.getByRole('region', { name: 'Carry-on packing list' });
  await expect(memory).toContainText('On this day · 1 year ago');
  await expect(memory).toContainText('Everything in one carry-on');

  // Rotate through every memory and back to the first; one of them is a playable video.
  const next = page.getByRole('button', { name: /Another memory/ });
  const total = Number((await next.textContent())!.match(/of (\d+)/)![1]);
  expect(total).toBe(8);
  let sawVideo = false;
  for (let i = 0; i < total; i++) {
    await expect(next).toContainText(`${i + 1} of ${total}`);
    if (await page.locator('section.memory video[controls]').count()) sawVideo = true;
    await next.click();
  }
  expect(sawVideo).toBe(true);
  await expect(next).toContainText(`1 of ${total}`);

  await page.locator('section.memory').getByRole('link', { name: /Open creation/ }).click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-atlas-packing$/);
  await expect(page.locator('.creation__info')).toContainText('Posted');
});

test('the ribbon shows real covers by day, opens a Day View, and leads to the full calendar', async ({ page }) => {
  await open(page, '/');
  const ribbon = page.getByRole('region', { name: 'Look what you’ve made' });
  await expect(ribbon).toContainText('posting since');
  // A day with two posts shows a collage with its count.
  const busy = ribbon.getByRole('button', { name: /: 2 posts$/ });
  await expect(busy).toHaveCount(1);
  await expect(busy.locator('.collage__count')).toHaveText('2');
  // Planned days look different from posted ones.
  await expect(ribbon.locator('.collage.is-planned').first()).toBeVisible();

  await busy.click();
  await expect(page).toHaveURL(/[?&]day=\d{4}-\d{2}-\d{2}/);
  const day = page.getByRole('dialog');
  await expect(day.locator('.dpost')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(day).toHaveCount(0);

  await ribbon.getByRole('link', { name: /Open calendar/ }).click();
  await expect(page).toHaveURL(/\/calendar$/);
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
  await expect(page.locator('.ribbon .collage.is-posted')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to your view' }).click();

  await page.goto('/?instant');
  await page.getByRole('button', { name: 'Change your photo' }).click();
  await page.getByRole('menuitem', { name: 'Remove photo' }).click();
  await expect(page.getByRole('button', { name: 'Add a photo of you' })).toBeVisible();
});

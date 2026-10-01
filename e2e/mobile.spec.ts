import { expect, test, type Page } from '@playwright/test';

/** Phone flow checks: quick capture, review, and checking today's work. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

test('phone layout uses the tab bar and never scrolls sideways', async ({ page }) => {
  for (const path of [
    '/',
    '/gallery',
    '/gallery?account=yt-pine',
    '/gallery?account=ig-atlas',
    '/gallery/v-ig-atlas',
    '/gallery/v-ig-pine-desk',
    '/ideas',
    '/ideas/market-phrases/versions',
    '/ideas/market-phrases/assets',
    '/calendar',
    '/studio',
    '/studio/proj-market',
    '/studio/proj-morning',
    '/studio/proj-market/drafts',
    '/studio/proj-market/plan',
    '/studio/proj-market/compare',
    '/library',
    '/campaigns',
    '/links',
    '/team',
  ]) {
    await open(page, path);
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary (mobile)' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Primary' })).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test('quick capture from the tab bar', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'Capture a new idea' }).click();
  await page.getByLabel('Working title').fill('Phone idea: ferry phrases');
  await page.getByRole('button', { name: 'Capture idea' }).click();
  await expect(page.getByRole('link', { name: /Phone idea: ferry phrases/ })).toBeVisible();
});

test('calendar becomes an agenda and the drawer reaches every section', async ({ page }) => {
  await open(page, '/calendar');
  // Phones get a compact visual month (covers only) above the agenda.
  await expect(page.locator('.month')).toBeVisible();
  await expect(page.locator('.month .cal-item').first()).toBeHidden();
  await expect(page.getByRole('region', { name: /Agenda/ })).toBeVisible();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: /^Open .*: 3 posts/ }).last().click();
  const day = page.getByRole('dialog');
  await expect(day.locator('.dpost')).toHaveCount(3);
  await day.getByRole('button', { name: 'Close day' }).click();
  await expect(day).toHaveCount(0);
  await page.getByRole('button', { name: 'More sections' }).click();
  const drawer = page.getByRole('navigation', { name: 'All sections' });
  await drawer.getByRole('link', { name: 'Raw Library' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Originals, kept safe');
});

test('review a version on the phone', async ({ page }) => {
  await open(page, '/ideas/market-phrases/versions?v=v-ig-atlas');
  // The finished video leads; the approximate platform preview is collapsed until asked for.
  await expect(page.locator('.vstage video')).toBeVisible();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview/ })).toBeHidden();
  await page.getByText('Instagram preview').click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Music rights noted' }).check();
  await expect(page.locator('.vrow.is-active')).toContainText('5/6');
});

test('Creation Gallery on the phone: preview label, ⓘ, account selector, Audience Pulse, opened creation', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('button', { name: /About this preview/ })).toBeVisible();
  const tabbar = page.getByRole('navigation', { name: 'Primary (mobile)' });
  await expect(tabbar.getByRole('link')).toHaveCount(3);
  await tabbar.getByRole('link', { name: 'Gallery' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creation Gallery');

  // ⓘ explanations open on tap and stay inside the screen.
  await page.getByRole('button', { name: 'About Post status' }).click();
  const pop = page.getByRole('region', { name: 'About Post status' });
  await expect(pop).toBeVisible();
  const box = (await pop.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('group', { name: 'Pine & Paper' }).getByRole('menuitemradio', { name: /Instagram/ }).click();
  await expect(page.getByTestId('audience-pulse')).toContainText('sample');
  await page.locator('.ctile[data-version="v-ig-pine-desk"]').click();
  await expect(page.getByRole('figure', { name: 'Photo 1 of 3' })).toBeVisible();
  await expect(page.getByText(/Not published/)).toBeVisible();
});

test('phone: review a video, tap a note to seek, and add a note at the playhead', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  const video = page.getByTestId('studio-video');
  await expect(video).toHaveJSProperty('duration', 3600);
  const panel = page.getByTestId('notes-panel');
  await panel.getByRole('button', { name: 'Jump to 0:55:20' }).tap();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBe(3320);
  await expect(panel.locator('.tnote.is-now')).toContainText('Wrap-up repeats the intro');
  await page.getByTestId('mark-moment').tap();
  await page.getByTestId('note-composer').getByLabel('Note').fill('Keep this pause.');
  await page.getByTestId('note-composer').getByRole('button', { name: 'Add note' }).tap();
  await expect(panel.locator('.tnote', { hasText: 'Keep this pause.' })).toContainText('0:55:20');
});

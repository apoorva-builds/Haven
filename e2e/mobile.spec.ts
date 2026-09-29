import { expect, test, type Page } from '@playwright/test';

/** Phone flow checks: quick capture, review, and checking today's work. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

test('phone layout uses the tab bar and never scrolls sideways', async ({ page }) => {
  for (const path of [
    '/',
    '/gallery',
    '/gallery?account=yt-mia',
    '/gallery?account=ig-explore',
    '/gallery/v-ig-explore',
    '/gallery/v-ig-mia-desk',
    '/ideas',
    '/ideas/street-food/versions',
    '/ideas/street-food/assets',
    '/calendar',
    '/library',
    '/campaigns',
    '/links',
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
  await page.getByLabel('Working title').fill('Phone idea: tea house phrases');
  await page.getByRole('button', { name: 'Capture idea' }).click();
  await expect(page.getByRole('link', { name: /Phone idea: tea house phrases/ })).toBeVisible();
});

test('calendar becomes an agenda and the drawer reaches every section', async ({ page }) => {
  await open(page, '/calendar');
  await expect(page.locator('.month')).toBeHidden();
  await expect(page.getByRole('region', { name: /Agenda/ })).toBeVisible();
  await page.getByRole('button', { name: 'More sections' }).click();
  const drawer = page.getByRole('navigation', { name: 'All sections' });
  await drawer.getByRole('link', { name: 'Raw Library' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Originals, kept safe');
});

test('review a version on the phone', async ({ page }) => {
  await open(page, '/ideas/street-food/versions?v=v-ig-explore');
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Music rights noted' }).check();
  await expect(page.locator('.vrow.is-active')).toContainText('5/6');
});

test('Creation Gallery on the phone: account selector, Audience Pulse, opened creation', async ({ page }) => {
  await open(page, '/');
  const tabbar = page.getByRole('navigation', { name: 'Primary (mobile)' });
  await expect(tabbar.getByRole('link')).toHaveCount(3);
  await tabbar.getByRole('link', { name: 'Gallery' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creation Gallery');
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('menuitemradio', { name: /@mia_yilin_/ }).click();
  await expect(page.getByTestId('audience-pulse')).toContainText('Sample data');
  await page.locator('.ctile[data-version="v-ig-mia-desk"]').click();
  await expect(page.getByRole('figure', { name: 'Photo 1 of 3' })).toBeVisible();
  await expect(page.getByText(/Not published/)).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

/** Phone flow checks: quick capture, review, and checking today's work. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

test('phone layout uses the tab bar and never scrolls sideways', async ({ page }) => {
  for (const path of ['/', '/ideas', '/ideas/slow-mornings/versions', '/ideas/slow-mornings/assets', '/accounts', '/accounts?videos=ig-studio', '/accounts/ig-studio', '/calendar', '/library', '/campaigns', '/links']) {
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
  await page.getByLabel('Working title').fill('Phone idea: shelf light at dusk');
  await page.getByRole('button', { name: 'Capture idea' }).click();
  await expect(page.getByRole('link', { name: /Phone idea: shelf light at dusk/ })).toBeVisible();
});

test('calendar becomes an agenda and the drawer reaches every section', async ({ page }) => {
  await open(page, '/calendar');
  await expect(page.locator('.month')).toBeHidden();
  await expect(page.getByRole('region', { name: /Agenda/ })).toBeVisible();
  await page.getByRole('button', { name: 'More sections' }).click();
  const drawer = page.getByRole('navigation', { name: 'All sections' });
  await drawer.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Originals, kept safe');
});

test('review a version on the phone', async ({ page }) => {
  await open(page, '/ideas/slow-mornings/versions?v=v-ig-personal');
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Music rights noted' }).check();
  await expect(page.locator('.vrow.is-active')).toContainText('4/6');
});

import { expect, test, type Page } from '@playwright/test';

/** The visual publishing calendar and its Day View. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
/** A date relative to today, as the app computes it (local calendar day). */
const iso = (offset: number) => {
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const goDirect = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const canPlay = (video: ReturnType<Page['locator']>) => expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 10_000 }).toBeGreaterThan(0);

test('a busy day shows a cover collage with its count and opens every post from that day', async ({ page }) => {
  await open(page, `/calendar?day=${iso(-20)}`);
  const day = page.getByRole('dialog');
  await expect(day.getByRole('heading', { level: 2 })).toContainText(new Date(`${iso(-20)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
  await expect(day).toContainText('3 posted');
  const posts = day.locator('.dpost');
  await expect(posts).toHaveCount(3);

  // Platform, account and Space for each post; source is honest.
  await expect(posts.nth(0)).toContainText('Instagram · Post · @littleatlas.sample');
  await expect(posts.nth(0)).toContainText('Little Atlas');
  await expect(posts.nth(0)).toContainText('Recorded in Haven');

  // Browse a carousel.
  const carousel = posts.nth(1);
  await expect(carousel.getByRole('img', { name: /photo 1 of 2/ })).toBeVisible();
  await carousel.getByRole('button', { name: 'Next photo' }).click();
  await expect(carousel.getByRole('img', { name: /photo 2 of 2/ })).toBeVisible();

  // Play a video; a late-night post stays on its local day.
  const late = posts.nth(2);
  await expect(late).toContainText('Posted at 11:40 PM');
  await canPlay(late.locator('video'));
  await expect(late).toContainText('No live link saved');

  // Live link only when one was saved; open the creation in Haven.
  await expect(posts.nth(0).getByRole('link', { name: /View live post/ })).toHaveAttribute('href', 'https://example.com/sample-posted-counter');
  await posts.nth(0).getByRole('link', { name: /Open in Haven/ }).click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-atlas-counter$/);
});

test('moving between dates: arrows, keyboard and the nearby-day strip', async ({ page }) => {
  await open(page, `/calendar?day=${iso(-20)}`);
  const day = page.getByRole('dialog');
  await day.getByRole('button', { name: /^Next day with posts/ }).click();
  await expect(page).toHaveURL(new RegExp(`day=${iso(-6)}`));
  await expect(day.locator('.dpost')).toHaveCount(2);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(new RegExp(`day=${iso(-3)}`));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(new RegExp(`day=${iso(-20)}`));
  await day.getByRole('navigation', { name: 'Nearby days with posts' }).getByRole('button', { name: /: 1 post$/ }).first().click();
  await expect(day.locator('.dpost')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(day).toHaveCount(0);
  await expect(page).not.toHaveURL(/day=/);
});

test('past posts and planned posts look different, in the month and in the Day View', async ({ page }) => {
  await open(page, '/calendar');
  await page.getByRole('button', { name: 'Previous month' }).click();
  const busy = page.getByRole('button', { name: /^Open .*: 3 posts/ }).last();
  await expect(busy.locator('.collage.is-posted')).toBeVisible();
  await expect(busy.locator('.collage__count')).toHaveText('3');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('.cal-item').first()).toBeVisible();

  await goDirect(page, `/calendar?day=${iso(0)}`);
  const day = page.getByRole('dialog');
  await expect(day.locator('.dpost.is-planned').first()).toContainText('Planned');
  await expect(day.getByRole('link', { name: /View live post/ })).toHaveCount(0);
  await expect(day).toContainText('Planned in Haven');
});

test('an empty date says so and offers the nearest days with posts', async ({ page }) => {
  await open(page, `/calendar?day=${iso(-12)}`);
  const day = page.getByRole('dialog');
  await expect(day).toContainText('Nothing posted on this day.');
  await day.getByRole('button', { name: new RegExp(new Date(`${iso(-6)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) }).first().click();
  await expect(day.locator('.dpost')).toHaveCount(2);
});

test('years of work: months with posts are one click away, including a year ago', async ({ page }) => {
  await open(page, '/calendar');
  const months = page.getByRole('navigation', { name: 'Months with posts' });
  const yearAgo = months.getByRole('button', { name: /1 posted, 0 planned/ }).first();
  await yearAgo.click();
  await expect(yearAgo).toHaveAttribute('aria-current', 'date');
  await page.getByRole('button', { name: /^Open .*: 1 post$/ }).first().click();
  await expect(page.getByRole('dialog').locator('.dpost')).toHaveCount(1);
});

test('collaborators see only permitted posts, including through direct Day View links', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();

  // A busy day of other accounts' posts: nothing is revealed.
  await goDirect(page, `/calendar?day=${iso(-20)}`);
  const day = page.getByRole('dialog');
  await expect(day).toContainText('Nothing posted on this day.');
  await expect(day.locator('.dpost')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // His own planned TikTok post is there.
  const mine = page.locator('.cal-item[data-version="v-tt-pine"]');
  await expect(mine).toBeVisible();
  await expect(page.locator('.cal-item:not([data-version^="v-tt-pine"])')).toHaveCount(0);
  await expect(page.locator('.day-open:not(.day-open--planned)')).toHaveCount(0);

  // Jonah sees the Pine & Paper posts and his one Little Atlas account.
  await page.getByRole('button', { name: 'Back to your view' }).click();
  await page.locator('.member-list').getByRole('button', { name: /Jonah/ }).click();
  await page.getByRole('button', { name: 'Preview as Jonah' }).click();
  await goDirect(page, `/calendar?day=${iso(-6)}`);
  await expect(page.getByRole('dialog').locator('.dpost')).toHaveCount(2);
});

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Desktop flow checks for the Milestone 1 review path. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

/** Click a primary (sidebar) navigation link; keeps the in-memory demo session. */
const nav = (page: Page, name: string) => page.getByRole('complementary', { name: 'Primary' }).getByRole('link', { name, exact: true }).click();

const sampleVideo = () => ({
  mimeType: 'video/webm',
  buffer: readFileSync(new URL('../public/demo-media/street-food-vertical.webm', import.meta.url)),
});

const canPlay = (video: ReturnType<Page['locator']>) => expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 10_000 }).toBeGreaterThan(0);

const tile = (page: Page, versionId: string) => page.locator(`.ctile[data-version="${versionId}"]`);

/** Pick an account in the Creation Gallery's compact selector. */
const chooseAccount = async (page: Page, name: string | RegExp) => {
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('menuitemradio', { name }).click();
};

test('theme toggle is remembered across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('Today shows one next action and task groups', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mia');
  await expect(page.getByRole('tab', { name: /Needs you/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Assigned to others/ }).click();
  await expect(page.getByText('Trim long cut to under 8 minutes')).toBeVisible();

  await page.getByRole('tab', { name: /Needs you/ }).click();
  await page.getByLabel('Focus').selectOption('account:tt-explore');
  const tasks = page.locator('.task-list .task__title');
  await expect(tasks.filter({ hasText: 'Record phrase 5 again, slower' })).toBeVisible();
  await expect(tasks.filter({ hasText: 'Approve the street-food Reel cover' })).toHaveCount(0);
  await page.getByLabel('Focus').selectOption('account:li-mia');
  await expect(page.getByText('No tasks match this focus')).toBeVisible();
  await page.getByLabel('Focus').selectOption('all');

  await page.getByRole('button', { name: 'Mark “Record phrase 5 again, slower” done' }).click();
  await expect(page.getByText(/marked done for this session/i)).toBeVisible();
});

test('one idea follows into three platforms and both Instagram accounts', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('link', { name: /Continue “Five phrases for ordering street food”/ }).click();
  await expect(page).toHaveURL(/\/ideas\/street-food\/versions/);

  const instagram = page.locator('.vgroup', { hasText: 'Instagram' });
  await expect(instagram.getByText('2 accounts')).toBeVisible();
  await expect(instagram.locator('.vrow')).toHaveCount(2);
  await expect(page.locator('.vrow')).toHaveCount(4);

  await instagram.getByRole('button', { name: /Explore with Mia \(demo\)/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for Explore with Mia \(demo\)/ })).toBeVisible();
  const caption = page.getByLabel(/Caption \(English\)/);
  await caption.fill('Five phrases, two speeds — edited in the demo');
  await expect(page.locator('.pv__cap')).toContainText('Five phrases, two speeds');

  await instagram.getByRole('button', { name: /@mia_yilin_/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for @mia_yilin_/ })).toBeVisible();

  await page.getByRole('button', { name: /@explorewithmia__/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate TikTok preview/ })).toBeVisible();

  await page.getByRole('button', { name: /@explorewith_mia/ }).click();
  await expect(page.locator('.pv--yt')).toContainText('Order street food in Mandarin');
});

test('posting is honest: Posted needs a live URL added by the creator', async ({ page }) => {
  await open(page, '/ideas/street-food/versions?v=v-tt-explore');
  await page.getByLabel('Version status').selectOption('Posted');
  await expect(page.getByText(/Haven can’t confirm a post by itself/)).toBeVisible();
  await expect(page.getByLabel('Version status')).toHaveValue('Ready to post');

  await page.getByRole('button', { name: /Ready-to-post bundle/ }).click();
  await expect(page.getByText(/no bundle is created/i)).toBeVisible();

  await page.getByLabel('Live URL (after posting)').fill('https://example.com/sample-live-123');
  await page.getByRole('button', { name: 'Mark as posted' }).click();
  await expect(page.getByLabel('Version status')).toHaveValue('Posted');
  await expect(page.getByText('view live post')).toBeVisible();

  await nav(page, 'Links');
  await expect(page.getByRole('link', { name: /Five phrases for ordering street food — Explore with Mia Clip/ })).toBeVisible();
});

test('ideas grid filters and shows an empty state', async ({ page }) => {
  await open(page, '/ideas');
  await expect(page.locator('.idea-tile')).toHaveCount(7);
  await page.getByLabel('Account', { exact: true }).selectOption('yt-mia');
  await expect(page.locator('.idea-tile')).toHaveCount(3);
  await page.getByLabel('Filter ideas by text').fill('nothing like this');
  await expect(page.getByText('No ideas match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.idea-tile')).toHaveCount(7);
  await page.getByRole('radio', { name: 'Archived' }).click();
  await expect(page.locator('.idea-tile')).toHaveCount(1);
});

test('loading state appears before content', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('status', { name: 'Loading ideas' })).toBeVisible();
  await expect(page.locator('.idea-tile').first()).toBeVisible();
});

test('quick capture creates a session-only idea with versions', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'New idea' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Capture an idea' });
  await expect(dialog.getByText('Session only')).toBeVisible();
  await dialog.getByLabel('Working title').fill('Night train phrases');
  await dialog.getByRole('button', { name: /@explorewith_mia/ }).click();
  await dialog.getByRole('button', { name: /Explore with Mia \(demo\)/ }).click();
  await dialog.getByRole('button', { name: 'Capture idea' }).click();
  await page.getByRole('link', { name: /Night train phrases/ }).click();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.locator('.vrow')).toHaveCount(2);
});

test('assets: demo uploads are labelled, interruptible and retryable', async ({ page }) => {
  await open(page, '/ideas/street-food/assets');
  await expect(page.getByText('Demo upload')).toBeVisible();
  await expect(page.getByText(/Files never leave your browser/)).toBeVisible();
  await expect(page.getByText(/Possible duplicate of/)).toBeVisible();
  await page.getByRole('button', { name: 'Try sample files' }).click();
  await expect(page.getByText(/Interrupted at \d+% \(simulated\)/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Retry from/ }).click();
  await expect(page.getByText('Added for this session only — not stored')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.getByText('Session only — not stored anywhere').first()).toBeVisible();
});

test('deleting an idea explains which originals are kept', async ({ page }) => {
  await open(page, '/ideas/street-food');
  await page.getByRole('button', { name: 'Idea actions' }).click();
  await page.getByRole('menuitem', { name: /Delete idea/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Raw Library originals and files used by other ideas are never removed/)).toBeVisible();
  await expect(dialog.getByText('Night market walk — raw.mov', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete idea' }).click();
  await expect(page).toHaveURL(/\/ideas$/);
  await nav(page, 'Raw Library');
  await expect(page.getByText('Night market walk — raw.mov', { exact: true })).toBeVisible();
});

test('old account links open that account in the Creation Gallery', async ({ page }) => {
  await open(page, '/accounts/yt-mia');
  await expect(page).toHaveURL(/\/gallery\?account=yt-mia/);
  await expect(page.getByRole('button', { name: 'Account: @miayilin' })).toBeVisible();
});

test('calendar filters and drag-to-reschedule', async ({ page }) => {
  await open(page, '/calendar');
  const items = page.locator('.cal-item');
  const all = await items.count();
  expect(all).toBeGreaterThan(5);
  await page.getByLabel('Platform').selectOption('tiktok');
  await expect(items.first()).toContainText('TT');
  expect(await items.count()).toBeLessThan(all);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('radio', { name: 'Marketing' }).click();
  await expect(page.locator('.cal-mk').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Content' }).click();

  const source = page.locator('[data-version="v-tt-mia"]');
  const date = await source.evaluate((el) => el.closest('[data-date]')!.getAttribute('data-date'));
  const target = page.locator('.month__day:not(.is-outside)').filter({ hasNot: page.locator('[data-version="v-tt-mia"]') }).last();
  const targetDate = await target.getAttribute('data-date');
  await source.dragTo(target);
  await expect(page.getByText(/this session only/)).toBeVisible();
  await expect(page.locator(`[data-date="${targetDate}"] [data-version="v-tt-mia"]`)).toBeVisible();
  expect(targetDate).not.toBe(date);
});

test('Raw Library: storage is labelled demo and packages produce no files', async ({ page }) => {
  await open(page, '/library');
  await expect(page.getByText('Demo figures').first()).toBeVisible();
  await expect(page.getByText(/Haven never removes originals on its own/)).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('brand');
  await expect(page.locator('.asset')).toHaveCount(3);
  await page.getByLabel('Type', { exact: true }).selectOption('all');
  await page.getByLabel(/Select Night market walk — raw\.mov/).check();
  await page.getByLabel(/Select Soft focus/).check();
  await page.getByRole('button', { name: 'Download package' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No files produced')).toBeVisible();
  await expect(dialog.getByText('music-rights.txt')).toBeVisible();
});

test('universal search jumps to results', async ({ page }) => {
  await open(page, '/');
  await page.keyboard.press('/');
  await page.keyboard.type('hangzhou');
  await page.getByRole('option', { name: /A weekend in Hangzhou/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A weekend in Hangzhou');
});

test('every primary route renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const path of [
    '/',
    '/gallery',
    '/gallery?account=yt-mia',
    '/gallery?account=ig-explore',
    '/gallery/v-ig-explore',
    '/gallery/v-ig-mia-desk',
    '/ideas',
    '/ideas/street-food',
    '/ideas/street-food/assets',
    '/ideas/street-food/versions',
    '/ideas/street-food/tasks',
    '/calendar',
    '/library',
    '/campaigns',
    '/links',
    '/nope',
  ]) {
    await open(page, path);
    await expect(page.locator('main h1, main .empty h3').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Raw Library holds source material only; device clips play in the page', async ({ page }) => {
  await open(page, '/library');
  await expect(page.locator('.page-header .eyebrow')).toHaveText('Raw Library');
  await expect(page.locator('.asset', { hasText: 'Street food phrases — vertical v2.webm' })).toHaveCount(0);
  await expect(page.locator('select[aria-label="Type"] option', { hasText: 'Finished video' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByTestId('upload-input').setInputFiles({ name: 'raw-market-clip.webm', ...sampleVideo() });
  await expect(page.getByText('Added for this session only — not stored')).toBeVisible({ timeout: 15_000 });
  const uploaded = page.locator('.asset', { hasText: 'raw-market-clip.webm' });
  await expect(uploaded).toHaveCount(1);
  await canPlay(uploaded.locator('video'));
  await expect(uploaded.getByText(/From this device · session only\. Not uploaded or stored online/)).toBeVisible();
  await expect(uploaded.getByText('Raw video')).toBeVisible();
});

test('Creation Gallery: every account together, one compact account filter', async ({ page }) => {
  await open(page, '/gallery');
  await expect(page.getByRole('button', { name: 'Account: All accounts' })).toBeVisible();
  await expect(page.getByTestId('audience-pulse')).toHaveCount(0);
  await expect(page.getByText(/Posts are samples made for this demo, not real drafts/)).toBeVisible();

  const reel = tile(page, 'v-ig-explore');
  await expect(reel.locator('.ctile__label')).toHaveText('Instagram · Reel');
  await expect(reel).toContainText('Explore with Mia (demo)');
  await expect(reel).toContainText('In review');
  await expect(reel).toContainText('Five phrases for ordering street food');
  await expect(reel.locator('video')).toHaveCount(1);
  await expect(tile(page, 'v-yt-mia').locator('.ctile__label')).toHaveText('YouTube · Long video');
  await expect(tile(page, 'v-yt-explore-short').locator('.ctile__label')).toHaveText('YouTube · Short');
  await expect(tile(page, 'v-tt-explore').locator('.ctile__label')).toHaveText('TikTok · Video');
  await expect(tile(page, 'v-ig-mia-desk').locator('.ctile__label')).toHaveText('Instagram · Carousel');
  await expect(tile(page, 'v-yt-mia-spots')).toContainText('Posted');
  await expect(page.locator('.ctile', { hasText: 'Five phrases for ordering street food' })).toHaveCount(4);

  // The selector groups accounts by brand and marks illustrative ones.
  await page.getByRole('button', { name: /^Account:/ }).click();
  const menu = page.getByRole('menu', { name: 'Choose account' });
  await expect(menu.getByRole('group', { name: 'Mia Yilin' }).getByRole('menuitemradio')).toHaveCount(4);
  await expect(menu.getByRole('group', { name: 'Explore with Mia' }).getByRole('menuitemradio')).toHaveCount(3);
  await expect(menu.getByRole('menuitemradio', { name: /Explore with Mia \(demo\).*Illustrative/ })).toBeVisible();
  await menu.getByRole('menuitemradio', { name: /@explorewith_mia/ }).click();

  await expect(page).toHaveURL(/account=yt-explore/);
  await expect(page.locator('.ctile')).toHaveCount(2);
  for (const t of await page.locator('.ctile').all()) await expect(t).toContainText('@explorewith_mia');

  await chooseAccount(page, 'All accounts');
  await page.getByLabel('Status').selectOption('posted');
  await expect(page.locator('.ctile')).toHaveCount(2);
});

test('Audience Pulse: sample counts, 7- and 30-day change, trend, and no stale count shown as current', async ({ page }) => {
  await open(page, '/gallery?account=yt-mia');
  const pulse = page.getByTestId('audience-pulse');
  await expect(pulse.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(pulse.getByTestId('pulse-count')).toHaveText('612K');
  await expect(pulse).toContainText('subscribers');
  await expect(pulse.getByTestId('delta-7')).toContainText('+');
  await expect(pulse.getByTestId('delta-30')).toContainText('%');
  await expect(pulse.getByRole('img', { name: /30-day subscribers trend \(sample data\)/ })).toBeVisible();
  await expect(pulse).toContainText(/Last updated .*\(3 hours ago\)/);
  await expect(pulse).toContainText('refreshed on a schedule from the YouTube API');
  await expect(pulse.getByRole('link', { name: /Profile/ })).toHaveAttribute('href', 'https://www.youtube.com/@miayilin');
  // Static, never animated as if live.
  const animated = await pulse.evaluate((el) => [el, ...el.querySelectorAll('*')].some((n) => getComputedStyle(n).animationName !== 'none'));
  expect(animated).toBe(false);

  // Illustrative account with an old manual snapshot: out of date, never the headline count.
  await chooseAccount(page, /Explore with Mia \(demo\)/);
  await expect(pulse.getByTestId('pulse-stale')).toBeVisible();
  await expect(pulse).toContainText('Out of date');
  await expect(pulse).toContainText(/Last known: .* followers, 9 days ago/);
  await expect(pulse.getByTestId('pulse-count')).toHaveCount(0);
  await expect(pulse.getByTestId('delta-7')).toHaveCount(0);
  await expect(pulse).toContainText('Updated by manual snapshot');
  await expect(pulse).toContainText('Illustrative demo account');
  await expect(pulse.getByRole('link', { name: /Profile/ })).toHaveCount(0);

  // A falling count reads as a decrease, not an increase.
  await chooseAccount(page, /@explorewithmia__/);
  await expect(pulse.getByTestId('delta-30')).toContainText('−');
});

test('opening a creation stays in Haven; the posted link appears only when posted', async ({ page }) => {
  await open(page, '/gallery');
  await tile(page, 'v-ig-explore').click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-explore$/);
  const stage = page.locator('.creation__stage');
  await canPlay(stage.locator('video'));
  await expect(stage.getByText(/Demo sample bundled with the prototype/)).toBeVisible();
  const info = page.locator('.creation__info');
  await expect(info.getByRole('link', { name: 'Explore with Mia (demo)' })).toBeVisible();
  await expect(info).toContainText('In review');
  await expect(info).toContainText('Planned for');
  await expect(info).toContainText('Save this before your next trip.');
  await expect(info).toContainText('Sample post made for this demo, not a real draft.');
  await expect(info.getByRole('link', { name: 'Five phrases for ordering street food' })).toBeVisible();
  await expect(info.getByText(/Not published\. Haven prepares posts but never publishes them/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.locator('.creation__siblings .ctile')).toHaveCount(3);

  await open(page, '/gallery/v-ig-mia-desk');
  await expect(page.getByRole('figure', { name: 'Photo 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.getByRole('figure', { name: 'Photo 2 of 3' })).toBeVisible();

  await open(page, '/gallery/v-yt-mia-spots');
  const postedLink = page.getByRole('link', { name: /Open posted video/ });
  await expect(postedLink).toHaveAttribute('href', 'https://example.com/sample-posted-short');
  await expect(postedLink).toHaveAttribute('target', '_blank');

  await open(page, '/ideas/street-food/versions?v=v-tt-explore');
  await page.getByLabel('Live URL (after posting)').fill('https://example.com/sample-live-42');
  await page.getByRole('button', { name: 'Mark as posted' }).click();
  await page.getByRole('link', { name: /View in Creation Gallery/ }).click();
  await expect(page.getByRole('link', { name: /Open posted video/ })).toHaveAttribute('href', 'https://example.com/sample-live-42');
  await expect(page.locator('.creation__info')).toContainText('Posted');
});

test('one finished video serves several account versions without a duplicate asset', async ({ page }) => {
  await open(page, '/ideas/reading-list/versions?v=v-tt-mia-books');

  await page.getByTestId('finished-video-input').setInputFiles({ name: 'books-final.webm', ...sampleVideo() });
  const selected = page.locator('.finished__selected');
  await canPlay(selected.locator('video'));
  await expect(selected.getByText(/From this device · session only/)).toBeVisible();
  await expect(page.getByText(/nothing was uploaded or posted/)).toBeVisible();

  await page.locator('.vrow', { hasText: '@miayilin' }).click();
  await page.getByLabel('Finished video for @miayilin').selectOption({ label: 'books-final.webm (this device, session only) · used by 1' });
  await expect(selected.getByText('Same file also used by')).toBeVisible();
  await expect(selected.locator('.abadge', { hasText: '@mia_yilin' })).toBeVisible();

  await page.getByRole('tab', { name: /Assets/ }).click();
  const card = page.locator('.asset', { hasText: 'books-final.webm' });
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('used-by')).toContainText('2 versions');
  await expect(card.getByText('Finished · Creation Gallery')).toBeVisible();
  await nav(page, 'Raw Library');
  await expect(page.locator('.asset').first()).toBeVisible();
  await expect(page.locator('.asset', { hasText: 'books-final.webm' })).toHaveCount(0);

  await nav(page, 'Creation Gallery');
  const tt = tile(page, 'v-tt-mia-books').locator('video');
  const yt = tile(page, 'v-yt-mia-books').locator('video');
  await expect(tt).toHaveAttribute('src', /^blob:/);
  expect(await tt.getAttribute('src')).toBe(await yt.getAttribute('src'));

  await chooseAccount(page, /@mia_yilin$/);
  await expect(tile(page, 'v-tt-mia-books')).toBeVisible();
  await expect(tile(page, 'v-yt-mia-books')).toHaveCount(0);

  await tile(page, 'v-tt-mia-books').click();
  await canPlay(page.locator('.creation__stage video'));
  await expect(page.locator('.creation__stage').getByText(/From this device · session only\. Not uploaded or stored online/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.getByText(/Not published/)).toBeVisible();
});

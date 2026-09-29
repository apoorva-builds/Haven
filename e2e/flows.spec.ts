import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Desktop flow checks for the Haven preview. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

/** Click a primary (sidebar) navigation link; keeps the in-memory session. */
const nav = (page: Page, name: string) => page.getByRole('complementary', { name: 'Primary' }).getByRole('link', { name, exact: true }).click();

const sampleVideo = () => ({
  mimeType: 'video/webm',
  buffer: readFileSync(new URL('../public/demo-media/market-vertical.webm', import.meta.url)),
});

const canPlay = (video: ReturnType<Page['locator']>) => expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 10_000 }).toBeGreaterThan(0);

const tile = (page: Page, versionId: string) => page.locator(`.ctile[data-version="${versionId}"]`);

/** Pick an account in the Creation Gallery's compact selector. */
const chooseAccount = async (page: Page, brand: string | null, platform?: string) => {
  await page.getByRole('button', { name: /^Account:/ }).click();
  const menu = page.getByRole('menu', { name: 'Choose account' });
  if (!brand) await menu.getByRole('menuitemradio', { name: 'All accounts' }).click();
  else await menu.getByRole('group', { name: brand }).getByRole('menuitemradio', { name: new RegExp(platform!) }).click();
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

test('the preview is labelled and explained in one About panel', async ({ page }) => {
  await open(page, '/gallery');
  const chip = page.getByRole('button', { name: /About this preview/ });
  await expect(chip).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await chip.click();
  const dialog = page.getByRole('dialog', { name: 'About this preview' });
  await expect(dialog).toContainText('Uploads are session-only.');
  await expect(dialog).toContainText('Follower counts are sample figures.');
  await expect(dialog).toContainText('Haven doesn’t post anything, and no social accounts are connected.');
  await expect(dialog).toContainText('fictional');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('ⓘ buttons explain sections on request and stay out of the way', async ({ page }) => {
  await open(page, '/gallery');
  await expect(page.getByRole('region', { name: /^About / })).toHaveCount(0);

  const galleryInfo = page.getByRole('button', { name: 'About Creation Gallery' });
  await expect(galleryInfo).toHaveAttribute('aria-expanded', 'false');
  await galleryInfo.click();
  await expect(galleryInfo).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'About Creation Gallery' })).toContainText('grouped by day');

  // Opening another closes the first; only one explanation at a time.
  await page.getByRole('button', { name: 'About Post status' }).click();
  await expect(page.getByRole('region', { name: 'About Creation Gallery' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'About Post status' })).toContainText('Haven never posts for you');

  // Escape closes and returns focus to the button.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: /^About / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'About Post status' })).toBeFocused();

  // Keyboard: Enter opens.
  await page.getByRole('button', { name: 'About Account filter' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'About Account filter' })).toContainText('grouped by brand');
  await page.mouse.click(5, 5);
  await expect(page.getByRole('region', { name: /^About / })).toHaveCount(0);

  await page.getByRole('button', { name: 'About Tiles and platform borders' }).click();
  await expect(page.getByRole('region', { name: 'About Tiles and platform borders' })).toContainText('border colour matches the platform');
  await page.keyboard.press('Escape');

  await chooseAccount(page, 'Pine & Paper', 'YouTube');
  await page.getByRole('button', { name: 'About Audience Pulse' }).click();
  await expect(page.getByRole('region', { name: 'About Audience Pulse' })).toContainText('figures are samples');
  await page.keyboard.press('Escape');

  await nav(page, 'Raw Library');
  await page.getByRole('button', { name: 'About Raw Library' }).click();
  await expect(page.getByRole('region', { name: 'About Raw Library' })).toContainText('Finished posts live in the Creation Gallery');
});

test('Today shows one next action and task groups', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Robin');
  await expect(page.getByRole('tab', { name: /Needs you/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Assigned to others/ }).click();
  await expect(page.getByText('Trim long cut to under 8 minutes')).toBeVisible();

  await page.getByRole('tab', { name: /Needs you/ }).click();
  await page.getByLabel('Focus', { exact: true }).selectOption('account:tt-pine');
  const tasks = page.locator('.task-list .task__title');
  await expect(tasks.filter({ hasText: 'Record phrase 5 again, slower' })).toBeVisible();
  await expect(tasks.filter({ hasText: 'Approve the market Reel cover' })).toHaveCount(0);
  await page.getByLabel('Focus', { exact: true }).selectOption('account:yt-pine');
  await expect(page.getByText('No tasks match this focus')).toBeVisible();
  await page.getByLabel('Focus', { exact: true }).selectOption('all');

  await page.getByRole('button', { name: 'Mark “Record phrase 5 again, slower” done' }).click();
  await expect(page.getByText(/marked done for this session/i)).toBeVisible();
});

test('one idea follows into three platforms and both Instagram accounts', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('link', { name: /Continue “Five phrases for a night market”/ }).click();
  await expect(page).toHaveURL(/\/ideas\/market-phrases\/versions/);

  const instagram = page.locator('.vgroup', { hasText: 'Instagram' });
  await expect(instagram.getByText('2 accounts')).toBeVisible();
  await expect(instagram.locator('.vrow')).toHaveCount(2);
  await expect(page.locator('.vrow')).toHaveCount(4);

  await instagram.getByRole('button', { name: /@littleatlas\.sample/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for @littleatlas\.sample/ })).toBeVisible();

  // The finished media is the focal point; the platform mock is small, labelled and secondary.
  const media = await page.locator('.vstage .player').boundingBox();
  const mock = await page.locator('.pp').boundingBox();
  expect(media!.width).toBeGreaterThan(mock!.width * 2);
  await expect(page.locator('.pp__approx')).toHaveText('Approximate');
  const caption = page.getByLabel(/Caption \(English\)/);
  await caption.fill('Five phrases, two speeds — edited in the preview');
  await expect(page.locator('.pv__cap')).toContainText('Five phrases, two speeds');

  await instagram.getByRole('button', { name: /@pinepaper\.sample/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for @pinepaper\.sample/ })).toBeVisible();

  await page.locator('.vgroup', { hasText: 'TikTok' }).locator('.vrow').click();
  await expect(page.getByRole('figure', { name: /Approximate TikTok preview/ })).toBeVisible();

  await page.locator('.vgroup', { hasText: 'YouTube' }).locator('.vrow').click();
  await expect(page.locator('.pv--yt')).toContainText('Five night-market phrases');
});

test('posting is honest: Posted needs a live URL added by the creator', async ({ page }) => {
  await open(page, '/ideas/market-phrases/versions?v=v-tt-pine');
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
  await expect(page.getByRole('link', { name: /Five phrases for a night market — Pine & Paper Clip/ })).toBeVisible();
});

test('ideas grid filters and shows an empty state', async ({ page }) => {
  await open(page, '/ideas');
  await expect(page.locator('.idea-tile')).toHaveCount(6);
  await page.getByLabel('Account', { exact: true }).selectOption('yt-pine');
  await expect(page.locator('.idea-tile')).toHaveCount(3);
  await page.getByLabel('Filter ideas by text').fill('nothing like this');
  await expect(page.getByText('No ideas match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.idea-tile')).toHaveCount(6);
  await page.getByRole('radio', { name: 'Archived' }).click();
  await expect(page.locator('.idea-tile')).toHaveCount(1);
});

test('loading state appears before content', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('status', { name: 'Loading ideas' })).toBeVisible();
  await expect(page.locator('.idea-tile').first()).toBeVisible();
});

test('quick capture creates a session-only idea with versions', async ({ page }) => {
  await open(page, '/gallery');
  // One primary action per page: the gallery's "New idea".
  await expect(page.locator('main .btn--primary')).toHaveCount(1);
  await page.getByRole('button', { name: 'New idea' }).click();
  const dialog = page.getByRole('dialog', { name: 'Capture an idea' });
  await expect(dialog.getByText('Session only')).toBeVisible();
  await dialog.getByLabel('Working title').fill('Train station phrases');
  await dialog.getByRole('button', { name: /YouTube @littleatlas\.sample/ }).click();
  await dialog.getByRole('button', { name: /Instagram @littleatlas\.sample/ }).click();
  await dialog.getByRole('button', { name: 'Capture idea' }).click();
  await expect(page).toHaveURL(/\/ideas$/);
  await page.locator('.idea-tile', { hasText: 'Train station phrases' }).click();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.locator('.vrow')).toHaveCount(2);
});

test('assets: uploads are labelled session-only, interruptible and retryable', async ({ page }) => {
  await open(page, '/ideas/market-phrases/assets');
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
  await open(page, '/ideas/market-phrases');
  await page.getByRole('button', { name: 'Idea actions' }).click();
  await page.getByRole('menuitem', { name: /Delete idea/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Raw Library originals and files used by other ideas are never removed/)).toBeVisible();
  await expect(dialog.getByText('Market walk — raw.mov', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete idea' }).click();
  await expect(page).toHaveURL(/\/ideas$/);
  await nav(page, 'Raw Library');
  await expect(page.getByText('Market walk — raw.mov', { exact: true })).toBeVisible();
});

test('old account links open that account in the Creation Gallery', async ({ page }) => {
  await open(page, '/accounts/yt-pine');
  await expect(page).toHaveURL(/\/gallery\?account=yt-pine/);
  await expect(page.getByRole('button', { name: 'Account: Pine & Paper YouTube' })).toBeVisible();
});

test('calendar filters and drag-to-reschedule', async ({ page }) => {
  await open(page, '/calendar');
  const items = page.locator('.cal-item');
  const all = await items.count();
  expect(all).toBeGreaterThan(4);
  await page.getByLabel('Platform').selectOption('tiktok');
  await expect(items.first()).toContainText('TT');
  expect(await items.count()).toBeLessThan(all);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('radio', { name: 'Marketing' }).click();
  await expect(page.locator('.cal-mk').first()).toBeVisible();
  await page.getByRole('radio', { name: 'Content' }).click();

  const source = page.locator('[data-version="v-ig-pine"]');
  const date = await source.evaluate((el) => el.closest('[data-date]')!.getAttribute('data-date'));
  const target = page.locator('.month__day:not(.is-outside)').filter({ hasNot: page.locator('[data-version="v-ig-pine"]') }).last();
  const targetDate = await target.getAttribute('data-date');
  await source.dragTo(target);
  await expect(page.getByText(/this session only/)).toBeVisible();
  await expect(page.locator(`[data-date="${targetDate}"] [data-version="v-ig-pine"]`)).toBeVisible();
  expect(targetDate).not.toBe(date);
});

test('Raw Library: storage is labelled demo and packages produce no files', async ({ page }) => {
  await open(page, '/library');
  await expect(page.getByText('Demo figures').first()).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('brand');
  await expect(page.locator('.asset')).toHaveCount(2);
  await page.getByLabel('Type', { exact: true }).selectOption('all');
  await page.getByLabel(/Select Market walk — raw\.mov/).check();
  await page.getByLabel(/Select Soft focus/).check();
  await page.getByRole('button', { name: 'Download package' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No files produced')).toBeVisible();
  await expect(dialog.getByText('music-rights.txt')).toBeVisible();
});

test('universal search jumps to results', async ({ page }) => {
  await open(page, '/');
  await page.keyboard.press('/');
  await page.keyboard.type('desk changes');
  await page.getByRole('option', { name: /Three small desk changes/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Three small desk changes');
});

test('every primary route renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const path of [
    '/',
    '/gallery',
    '/gallery?account=yt-pine',
    '/gallery?account=ig-atlas',
    '/gallery/v-ig-atlas',
    '/gallery/v-ig-pine-desk',
    '/ideas',
    '/ideas/market-phrases',
    '/ideas/market-phrases/assets',
    '/ideas/market-phrases/versions',
    '/ideas/market-phrases/tasks',
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
  await expect(page.locator('.page-header .eyebrow')).toContainText('Raw Library');
  await expect(page.locator('.asset', { hasText: 'Night market phrases — vertical.webm' })).toHaveCount(0);
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

  const reel = tile(page, 'v-ig-atlas');
  await expect(reel.locator('.ctile__label')).toHaveText('Instagram · Reel');
  // Tiles show only title, platform/format and status; the account lives in the opened view.
  await expect(reel).toContainText('Five phrases for a night market');
  await expect(reel).toContainText('In review');
  await expect(reel).not.toContainText('@littleatlas.sample');
  await expect(reel).toHaveAttribute('aria-label', /@littleatlas\.sample/);
  await expect(page.locator('.ctile__media').first()).toHaveCSS('border-top-width', '0px');
  await expect(reel.locator('video')).toHaveCount(1);
  await expect(tile(page, 'v-yt-pine').locator('.ctile__label')).toHaveText('YouTube · Long video');
  await expect(tile(page, 'v-yt-atlas-short').locator('.ctile__label')).toHaveText('YouTube · Short');
  await expect(tile(page, 'v-tt-pine').locator('.ctile__label')).toHaveText('TikTok · Video');
  await expect(tile(page, 'v-ig-pine-desk').locator('.ctile__label')).toHaveText('Instagram · Carousel');
  await expect(tile(page, 'v-yt-pine-spots')).toContainText('Posted');
  await expect(page.locator('.ctile[aria-label*="Five phrases for a night market"]')).toHaveCount(4);

  await page.getByRole('button', { name: /^Account:/ }).click();
  const menu = page.getByRole('menu', { name: 'Choose account' });
  await expect(menu.getByRole('group', { name: 'Pine & Paper' }).getByRole('menuitemradio')).toHaveCount(3);
  await expect(menu.getByRole('group', { name: 'Little Atlas' }).getByRole('menuitemradio')).toHaveCount(2);
  await menu.getByRole('group', { name: 'Pine & Paper' }).getByRole('menuitemradio', { name: /Instagram/ }).click();

  await expect(page).toHaveURL(/account=ig-pine/);
  await expect(page.locator('.ctile')).toHaveCount(3);
  for (const t of await page.locator('.ctile').all()) await expect(t.locator('.ctile__label')).toContainText('Instagram');

  await chooseAccount(page, null);
  await page.getByLabel('Status', { exact: true }).selectOption('posted');
  await expect(page.locator('.ctile')).toHaveCount(2);
});

test('Audience Pulse: sample counts, 7- and 30-day change, trend, and no stale count shown as current', async ({ page }) => {
  await open(page, '/gallery?account=yt-pine');
  const pulse = page.getByTestId('audience-pulse');
  await expect(pulse.getByTestId('pulse-count')).toHaveText('24.8K');
  await expect(pulse).toContainText('subscribers');
  await expect(pulse.getByTestId('pulse-sample')).toHaveText('sample');
  await expect(pulse.getByTestId('delta-7')).toContainText('+');
  await expect(pulse.getByTestId('delta-30')).toContainText('%');
  await expect(pulse.getByRole('img', { name: /30-day subscribers trend \(sample\)/ })).toBeVisible();
  await expect(pulse).toContainText(/Last updated .* · 3 hours ago/);
  const animated = await pulse.evaluate((el) => [el, ...el.querySelectorAll('*')].some((n) => getComputedStyle(n).animationName !== 'none'));
  expect(animated).toBe(false);

  await chooseAccount(page, 'Little Atlas', 'Instagram');
  await expect(pulse.getByTestId('pulse-stale')).toBeVisible();
  await expect(pulse).toContainText('Out of date');
  await expect(pulse).toContainText(/Last known: 6\.12K followers \(sample\), 9 days ago/);
  await expect(pulse).toContainText('Add a new snapshot');
  await expect(pulse.getByTestId('pulse-count')).toHaveCount(0);
  await expect(pulse.getByTestId('delta-7')).toHaveCount(0);

  await chooseAccount(page, 'Pine & Paper', 'TikTok');
  await expect(pulse.getByTestId('delta-30')).toContainText('−');
});

test('opening a creation stays in Haven; the posted link appears only when posted', async ({ page }) => {
  await open(page, '/gallery');
  await tile(page, 'v-ig-atlas').click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-atlas$/);
  const stage = page.locator('.creation__stage');
  await canPlay(stage.locator('video'));
  await expect(stage.getByText(/Demo sample bundled with the prototype/)).toBeVisible();
  const info = page.locator('.creation__info');
  await expect(info.getByRole('link', { name: '@littleatlas.sample' })).toBeVisible();
  await expect(info).toContainText('In review');
  await expect(info).toContainText('Planned for');
  await expect(info).toContainText('Save this before your next trip.');
  await expect(info.getByRole('link', { name: 'Five phrases for a night market' })).toBeVisible();
  await expect(info.getByText(/Not published\. Haven prepares posts but never publishes them/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.locator('.creation__siblings .ctile')).toHaveCount(3);

  await open(page, '/gallery/v-ig-pine-desk');
  await expect(page.getByRole('figure', { name: 'Photo 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.getByRole('figure', { name: 'Photo 2 of 3' })).toBeVisible();

  await open(page, '/gallery/v-yt-pine-spots');
  const postedLink = page.getByRole('link', { name: /Open posted video/ });
  await expect(postedLink).toHaveAttribute('href', 'https://example.com/sample-posted-short');
  await expect(postedLink).toHaveAttribute('target', '_blank');

  await open(page, '/ideas/market-phrases/versions?v=v-tt-pine');
  await page.getByLabel('Live URL (after posting)').fill('https://example.com/sample-live-42');
  await page.getByRole('button', { name: 'Mark as posted' }).click();
  await page.getByRole('link', { name: /View in Creation Gallery/ }).click();
  await expect(page.getByRole('link', { name: /Open posted video/ })).toHaveAttribute('href', 'https://example.com/sample-live-42');
  await expect(page.locator('.creation__info')).toContainText('Posted');
});

test('one finished video serves several account versions without a duplicate asset', async ({ page }) => {
  await open(page, '/ideas/reading-list/versions?v=v-tt-pine-books');

  await page.getByTestId('finished-video-input').setInputFiles({ name: 'books-final.webm', ...sampleVideo() });
  const selected = page.locator('.finished__selected');
  await canPlay(selected.locator('video'));
  await expect(selected.getByText(/From this device · session only/)).toBeVisible();
  await expect(page.getByText(/nothing was uploaded or posted/)).toBeVisible();

  await page.locator('.vgroup', { hasText: 'YouTube' }).locator('.vrow').click();
  await page.getByLabel('Finished video for @pinepaper.sample').selectOption({ label: 'books-final.webm (this device, session only) · used by 1' });
  await expect(selected.getByText('Same file also used by')).toBeVisible();

  await page.getByRole('tab', { name: /Assets/ }).click();
  const card = page.locator('.asset', { hasText: 'books-final.webm' });
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('used-by')).toContainText('2 versions');
  await expect(card.getByText('Finished · Creation Gallery')).toBeVisible();
  await nav(page, 'Raw Library');
  await expect(page.locator('.asset').first()).toBeVisible();
  await expect(page.locator('.asset', { hasText: 'books-final.webm' })).toHaveCount(0);

  await nav(page, 'Creation Gallery');
  const tt = tile(page, 'v-tt-pine-books').locator('video');
  const yt = tile(page, 'v-yt-pine-books').locator('video');
  await expect(tt).toHaveAttribute('src', /^blob:/);
  expect(await tt.getAttribute('src')).toBe(await yt.getAttribute('src'));

  await chooseAccount(page, 'Pine & Paper', 'TikTok');
  await expect(tile(page, 'v-tt-pine-books')).toBeVisible();
  await expect(tile(page, 'v-yt-pine-books')).toHaveCount(0);

  await tile(page, 'v-tt-pine-books').click();
  await canPlay(page.locator('.creation__stage video'));
  await expect(page.locator('.creation__stage').getByText(/From this device · session only\. Not uploaded or stored online/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.getByText(/Not published/)).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** Desktop flow checks for the Milestone 1 review path. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

/** Click a primary (sidebar) navigation link; keeps the in-memory demo session. */
const nav = (page: Page, name: string) => page.getByRole('complementary', { name: 'Primary' }).getByRole('link', { name, exact: true }).click();

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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mira');
  await expect(page.getByRole('tab', { name: /Needs you/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Assigned to others/ }).click();
  await expect(page.getByText('Cut 16:9 edit to under 7 minutes')).toBeVisible();

  // Focus on one account narrows the list.
  await page.getByRole('tab', { name: /Needs you/ }).click();
  await page.getByLabel('Focus').selectOption('account:tt-main');
  const tasks = page.locator('.task-list .task__title');
  await expect(tasks.filter({ hasText: 'Post wheel-throwing clip to TikTok' })).toBeVisible();
  await expect(tasks.filter({ hasText: 'Approve cover for the personal Reel' })).toHaveCount(0);
  await page.getByLabel('Focus').selectOption('account:li-main');
  await expect(page.getByText('No tasks match this focus')).toBeVisible();
  await page.getByLabel('Focus').selectOption('account:tt-main');

  // Completing a task gives honest, session-scoped feedback.
  await page.getByRole('button', { name: 'Mark “Post wheel-throwing clip to TikTok” done' }).click();
  await expect(page.getByText(/marked done for this session/i)).toBeVisible();
});

test('one idea follows into two platforms and two Instagram accounts', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('link', { name: /Continue “Slow mornings in the studio”/ }).click();
  await expect(page).toHaveURL(/\/ideas\/slow-mornings\/versions/);

  const instagram = page.locator('.vgroup', { hasText: 'Instagram' });
  await expect(instagram.getByText('2 accounts')).toBeVisible();
  await expect(instagram.locator('.vrow')).toHaveCount(2);
  await expect(page.locator('.vrow')).toHaveCount(4);

  // Personal Instagram
  await instagram.getByRole('button', { name: /@mira\.lane\.demo/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: /@mira\.lane\.demo/ })).toBeVisible();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for @mira\.lane\.demo/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Español' })).toBeVisible();

  // Business Instagram — its own caption and cover
  await instagram.getByRole('button', { name: /@lanestudio\.demo/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate Instagram preview for @lanestudio\.demo/ })).toBeVisible();
  const caption = page.getByLabel(/Caption \(English\)/);
  await expect(caption).toHaveValue(/Tidewater opens Friday/);
  await caption.fill('Shop drop Friday 10am — studio account caption');
  await expect(page.locator('.pv__cap')).toContainText('Shop drop Friday 10am');

  // TikTok
  await page.getByRole('button', { name: /@miralane\.demo/ }).click();
  await expect(page.getByRole('figure', { name: /Approximate TikTok preview/ })).toBeVisible();
  await expect(page.getByText(/Approximate preview\. TikTok crops/)).toBeVisible();

  // YouTube — a wide frame with a title
  await page.getByRole('button', { name: /@MiraLaneStudioDemo/ }).click();
  await expect(page.locator('.pv--yt')).toContainText('Slow Mornings in a Pottery Studio');
});

test('posting is honest: Posted needs a live URL added by the creator', async ({ page }) => {
  await open(page, '/ideas/slow-mornings/versions?v=v-tt');
  await page.getByLabel('Version status').selectOption('Posted');
  await expect(page.getByText(/Haven can’t confirm a post by itself/)).toBeVisible();
  await expect(page.getByLabel('Version status')).toHaveValue('Ready to post');

  await page.getByRole('button', { name: /Ready-to-post bundle/ }).click();
  await expect(page.getByText(/no bundle is created/i)).toBeVisible();

  await page.getByLabel('Live URL (after posting)').fill('https://www.tiktok.com/@miralane.demo/video/123');
  await page.getByRole('button', { name: 'Mark as posted' }).click();
  await expect(page.getByLabel('Version status')).toHaveValue('Posted');
  await expect(page.getByText('view live post')).toBeVisible();

  await page.getByRole('link', { name: 'Links', exact: true }).click();
  await expect(page.getByRole('link', { name: /Slow mornings in the studio — Mira Lane Clip/ })).toBeVisible();
});

test('ideas grid filters and shows an empty state', async ({ page }) => {
  await open(page, '/ideas');
  await expect(page.locator('.idea-tile')).toHaveCount(7);
  await page.getByLabel('Account').selectOption('yt-main');
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
  await dialog.getByLabel('Working title').fill('Ash glaze from the fireplace');
  await dialog.getByRole('button', { name: /@lanestudio\.demo/ }).click();
  await dialog.getByRole('button', { name: /@mira\.lane\.demo/ }).click();
  await dialog.getByRole('button', { name: 'Capture idea' }).click();
  await page.getByRole('link', { name: /Ash glaze from the fireplace/ }).click();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.locator('.vgroup', { hasText: 'Instagram' }).locator('.vrow')).toHaveCount(2);
});

test('assets: demo uploads are labelled, interruptible and retryable', async ({ page }) => {
  await open(page, '/ideas/slow-mornings/assets');
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
  await open(page, '/ideas/slow-mornings');
  await page.getByRole('button', { name: 'Idea actions' }).click();
  await page.getByRole('menuitem', { name: /Delete idea/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Library originals and files used by other ideas are never removed/)).toBeVisible();
  await expect(dialog.getByText('Glaze dip — 120fps.mov')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete idea' }).click();
  await expect(page).toHaveURL(/\/ideas$/);
  await nav(page, 'Raw Library');
  await expect(page.getByText('Glaze dip — 120fps.mov')).toBeVisible();
});

test('accounts: several per platform, native analytics as links only', async ({ page }) => {
  await open(page, '/accounts');
  const instagram = page.locator('#platform-instagram');
  await expect(instagram.locator('.account-card')).toHaveCount(2);
  await expect(page.locator('#platform-snapchat').getByText('No Snapchat accounts yet.')).toBeVisible();
  await instagram.getByRole('link', { name: /@lanestudio\.demo/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('@lanestudio.demo');
  await expect(page.getByText(/Haven does not import or display analytics/)).toBeVisible();
  const analytics = page.getByRole('link', { name: /Open Instagram analytics/ });
  await expect(analytics).toHaveAttribute('target', '_blank');
  await page.getByRole('navigation', { name: 'Other Instagram accounts' }).getByRole('link', { name: /@mira\.lane\.demo/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('@mira.lane.demo');
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

  const source = page.locator('[data-version="v-yt"]');
  const date = await source.evaluate((el) => el.closest('[data-date]')!.getAttribute('data-date'));
  const target = page.locator('.month__day:not(.is-outside)').filter({ hasNot: page.locator('[data-version="v-yt"]') }).last();
  const targetDate = await target.getAttribute('data-date');
  await source.dragTo(target);
  await expect(page.getByText(/this session only/)).toBeVisible();
  await expect(page.locator(`[data-date="${targetDate}"] [data-version="v-yt"]`)).toBeVisible();
  expect(targetDate).not.toBe(date);
});

test('library: storage is labelled demo and packages produce no files', async ({ page }) => {
  await open(page, '/library');
  await expect(page.getByText('Demo figures').first()).toBeVisible();
  await expect(page.getByText(/Haven never removes originals on its own/)).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('brand');
  await expect(page.locator('.asset')).toHaveCount(3);
  await page.getByLabel('Type', { exact: true }).selectOption('all');
  await page.getByLabel(/Select Glaze dip/).check();
  await page.getByLabel(/Select Morning Room/).check();
  await page.getByRole('button', { name: 'Download package' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No files produced')).toBeVisible();
  await expect(dialog.getByText('music-rights.txt')).toBeVisible();
});

test('universal search jumps to results', async ({ page }) => {
  await open(page, '/');
  await page.keyboard.press('/');
  await page.keyboard.type('kiln');
  await page.getByRole('option', { name: /First firing in the Kiln & Co\. compact/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First firing in the Kiln & Co. compact');
});

test('every primary route renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const path of ['/', '/gallery', '/gallery?account=ig-studio', '/gallery/v-ig-personal', '/gallery/v-blues-ig', '/ideas', '/ideas/slow-mornings', '/ideas/slow-mornings/assets', '/ideas/slow-mornings/versions', '/ideas/slow-mornings/tasks', '/accounts', '/accounts/yt-main', '/calendar', '/library', '/campaigns', '/links', '/nope']) {
    await open(page, path);
    await expect(page.locator('main h1, main .empty h3').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

const sampleVideo = () => ({
  mimeType: 'video/webm',
  buffer: readFileSync(new URL('../public/demo-media/slow-mornings-vertical.webm', import.meta.url)),
});

const canPlay = (video: ReturnType<Page['locator']>) => expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 10_000 }).toBeGreaterThan(0);

const tile = (page: Page, versionId: string) => page.locator(`.ctile[data-version="${versionId}"]`);

test('Raw Library holds source material only; device clips play in the page', async ({ page }) => {
  await open(page, '/library');
  await expect(page.locator('.page-header .eyebrow')).toHaveText('Raw Library');
  await expect(page.getByRole('link', { name: 'Creation Gallery', exact: true }).last()).toBeVisible();
  await expect(page.locator('.asset', { hasText: 'Slow mornings — vertical v3.webm' })).toHaveCount(0);
  await expect(page.locator('select[aria-label="Type"] option', { hasText: 'Finished video' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByTestId('upload-input').setInputFiles({ name: 'raw-kiln-clip.webm', ...sampleVideo() });
  await expect(page.getByText('Added for this session only — not stored')).toBeVisible({ timeout: 15_000 });
  const uploaded = page.locator('.asset', { hasText: 'raw-kiln-clip.webm' });
  await expect(uploaded).toHaveCount(1);
  await canPlay(uploaded.locator('video'));
  await expect(uploaded.getByText(/From this device · session only\. Not uploaded or stored online/)).toBeVisible();
  await expect(uploaded.getByText('Raw video')).toBeVisible();
});

test('Creation Gallery shows creations by day across platforms, with account filters', async ({ page }) => {
  await open(page, '/gallery');
  await expect(page.getByRole('heading', { level: 2, name: /^Today/ })).toBeVisible();

  const personal = tile(page, 'v-ig-personal');
  await expect(personal.locator('.ctile__label')).toHaveText('Instagram · Reel');
  await expect(personal).toContainText('@mira.lane.demo');
  await expect(personal).toContainText('In review');
  await expect(personal).toContainText('Slow mornings in the studio');
  await expect(personal.locator('video')).toHaveCount(1);
  await expect(tile(page, 'v-yt').locator('.ctile__label')).toHaveText('YouTube · Long video');
  await expect(tile(page, 'v-tt').locator('.ctile__label')).toHaveText('TikTok · Video');
  await expect(tile(page, 'v-blues-ig').locator('.ctile__label')).toHaveText('Instagram · Carousel');
  await expect(tile(page, 'v-blues-ig')).toContainText('3 photos');
  await expect(tile(page, 'v-market-ig')).toContainText('Posted');

  // Several versions of one idea, each its own tile, all tied to the idea.
  const heroTiles = page.locator('.ctile', { hasText: 'Slow mornings in the studio' });
  await expect(heroTiles).toHaveCount(4);
  await expect(heroTiles.first()).toContainText('4 versions');

  // Individual account filter.
  await page.getByRole('radio', { name: /@lanestudio\.demo/ }).click();
  await expect(page.getByText(/Showing 3 creations for/)).toBeVisible();
  await expect(page.locator('.ctile')).toHaveCount(3);
  for (const t of await page.locator('.ctile').all()) await expect(t).toContainText('@lanestudio.demo');

  // Status filter composes with the account filter; All accounts resets it.
  await page.getByRole('radio', { name: 'All accounts' }).click();
  await page.getByRole('radio', { name: 'Posted' }).click();
  await expect(page.locator('.ctile')).toHaveCount(1);
  await expect(tile(page, 'v-market-ig')).toBeVisible();
});

test('opening a creation stays in Haven; the posted link appears only when posted', async ({ page }) => {
  await open(page, '/gallery');
  await tile(page, 'v-ig-personal').click();
  await expect(page).toHaveURL(/\/gallery\/v-ig-personal$/);
  const stage = page.locator('.creation__stage');
  await canPlay(stage.locator('video'));
  await expect(stage.getByText(/Demo sample bundled with the prototype/)).toBeVisible();
  const info = page.locator('.creation__info');
  await expect(info.getByRole('link', { name: '@mira.lane.demo' })).toBeVisible();
  await expect(info).toContainText('In review');
  await expect(info).toContainText('Planned for');
  await expect(info).toContainText('Most mornings start before the wheel does.');
  await info.getByRole('tab', { name: 'ES' }).click();
  await expect(info).toContainText('La mayoría de las mañanas');
  await expect(info.getByRole('link', { name: 'Slow mornings in the studio' })).toBeVisible();
  await expect(info.getByText(/Not published\. Haven prepares posts but never publishes them/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.locator('.creation__siblings .ctile')).toHaveCount(3);

  // A carousel shows its photos.
  await page.locator('.creation__siblings').getByRole('link', { name: /Instagram · Reel for @lanestudio/ }).isVisible();
  await open(page, '/gallery/v-blues-ig');
  await expect(page.getByRole('figure', { name: 'Photo 1 of 3' })).toBeVisible();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.getByRole('figure', { name: 'Photo 2 of 3' })).toBeVisible();

  // Seeded posted version with a saved live URL.
  await open(page, '/gallery/v-market-ig');
  const postedLink = page.getByRole('link', { name: /Open posted video/ });
  await expect(postedLink).toHaveAttribute('href', 'https://www.instagram.com/mira.lane.demo/');
  await expect(postedLink).toHaveAttribute('target', '_blank');

  // Marking a version posted with a live URL makes the button appear on its creation.
  await open(page, '/ideas/slow-mornings/versions?v=v-tt');
  await page.getByLabel('Live URL (after posting)').fill('https://www.tiktok.com/@miralane.demo/video/42');
  await page.getByRole('button', { name: 'Mark as posted' }).click();
  await page.getByRole('link', { name: /View in Creation Gallery/ }).click();
  await expect(page.getByRole('link', { name: /Open posted video/ })).toHaveAttribute('href', 'https://www.tiktok.com/@miralane.demo/video/42');
  await expect(page.locator('.creation__info')).toContainText('Posted');
});

test('one finished video serves several account versions without a duplicate asset', async ({ page }) => {
  await open(page, '/ideas/wheel-60/versions?v=v-wheel-tt');

  // TikTok version: finished video from this device (session only).
  await page.getByTestId('finished-video-input').setInputFiles({ name: 'wheel-final.webm', ...sampleVideo() });
  const selected = page.locator('.finished__selected');
  await canPlay(selected.locator('video'));
  await expect(selected.getByText(/From this device · session only/)).toBeVisible();
  await expect(page.getByText(/nothing was uploaded or posted/)).toBeVisible();

  // Instagram personal version: same file, no copy.
  await page.locator('.vrow', { hasText: '@mira.lane.demo' }).click();
  await page.getByLabel('Finished video for @mira.lane.demo').selectOption({ label: 'wheel-final.webm (this device, session only) · used by 1' });
  await expect(selected.getByText('Same file also used by')).toBeVisible();
  await expect(selected.locator('.abadge', { hasText: '@miralane.demo' })).toBeVisible();

  // One asset, used by two versions; it is a finished video, not Raw Library material.
  await page.getByRole('tab', { name: /Assets/ }).click();
  const card = page.locator('.asset', { hasText: 'wheel-final.webm' });
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('used-by')).toContainText('2 versions');
  await expect(card.getByText('Finished · Creation Gallery')).toBeVisible();
  await nav(page, 'Raw Library');
  await expect(page.locator('.asset').first()).toBeVisible();
  await expect(page.locator('.asset', { hasText: 'wheel-final.webm' })).toHaveCount(0);

  // Creation Gallery: both account tiles play the very same file.
  await nav(page, 'Creation Gallery');
  const tt = tile(page, 'v-wheel-tt').locator('video');
  const ig = tile(page, 'v-wheel-ig').locator('video');
  await expect(tt).toHaveAttribute('src', /^blob:/);
  expect(await tt.getAttribute('src')).toBe(await ig.getAttribute('src'));

  await page.getByRole('radio', { name: /@miralane\.demo/ }).click();
  await expect(tile(page, 'v-wheel-tt')).toBeVisible();
  await expect(tile(page, 'v-wheel-ig')).toHaveCount(0);

  await tile(page, 'v-wheel-tt').click();
  await canPlay(page.locator('.creation__stage video'));
  await expect(page.locator('.creation__stage').getByText(/From this device · session only\. Not uploaded or stored online/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Open posted/ })).toHaveCount(0);
  await expect(page.getByText(/Not published/)).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';

/** Desktop flow checks for the Milestone 1 review path. */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);

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
  await page.getByRole('link', { name: 'Library', exact: true }).click();
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
  for (const path of ['/', '/ideas', '/ideas/slow-mornings', '/ideas/slow-mornings/assets', '/ideas/slow-mornings/versions', '/ideas/slow-mornings/tasks', '/accounts', '/accounts/yt-main', '/calendar', '/library', '/campaigns', '/links', '/nope']) {
    await open(page, path);
    await expect(page.locator('main h1, main .empty h3').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/**
 * Video Studio. Media are bundled samples (vite preview serves byte ranges,
 * so seeking is real). Everything else lasts for the browser session only.
 */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const goDirect = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const video = (page: Page) => page.getByTestId('studio-video');
const currentTime = (page: Page) => video(page).evaluate((v: HTMLVideoElement) => v.currentTime);
const panel = (page: Page) => page.getByTestId('notes-panel');

test('short video: plays, notes follow playback, clicking a note seeks to it', async ({ page }) => {
  await open(page, '/studio/proj-market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Night market phrases — vertical');
  await expect(video(page)).toHaveJSProperty('duration', 26);
  await expect(page.getByTestId('timecode')).toContainText('0:00 / 0:26');
  // No "hour" on a short clip.
  await expect(page.locator('.shead')).not.toContainText(/\bhr\b|1:00:00/);

  // At the start the opening range is the current note.
  await expect(panel(page).locator('.tnote.is-now')).toContainText('Hook lands now');

  // Click a note: the video seeks there and the panel focuses it.
  await panel(page).getByRole('button', { name: 'Jump to 0:06' }).click();
  await expect.poll(() => currentTime(page)).toBeCloseTo(6, 0);
  await expect(page.getByTestId('timecode')).toContainText('0:06');
  await expect(panel(page).locator('.tnote.is-now')).toContainText('Caption overlaps the safe zone');

  // Play: time advances and the focus moves on to the end-card range.
  await video(page).evaluate((v: HTMLVideoElement) => (v.currentTime = 21.5));
  await page.getByTestId('play').click();
  await expect.poll(() => currentTime(page), { timeout: 5000 }).toBeGreaterThan(22.2);
  await expect(panel(page).locator('.tnote.is-now')).toContainText('End card');
  const progress = panel(page).locator('.tnote.is-now [role="progressbar"]');
  await expect(progress).toBeVisible();
  await page.getByTestId('play').click();

  // The Notes panel can be hidden during playback.
  await page.keyboard.press('n');
  await expect(panel(page)).toHaveCount(0);
  await page.getByTestId('toggle-notes').click();
  await expect(panel(page)).toBeVisible();
});

test('one-hour sample: seekable, chapters, zoom, and notes at the beginning, middle and end', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  await expect(page.getByTestId('timecode')).toContainText('/ 1:00:00');
  await expect(page.locator('.shead')).toContainText('1 hr 00 min');
  const seekableEnd = await video(page).evaluate((v: HTMLVideoElement) => (v.seekable.length ? v.seekable.end(0) : 0));
  expect(seekableEnd).toBe(3600);

  // Notes near the beginning, middle and end.
  for (const t of ['0:00:45', '0:28:00', '0:55:20']) await expect(panel(page).getByRole('button', { name: `Jump to ${t}` })).toBeVisible();

  // Seek to the middle note; the picture really moves there.
  await panel(page).getByRole('button', { name: 'Jump to 0:28:00' }).click();
  await expect.poll(() => currentTime(page)).toBe(1680);
  await expect(panel(page).locator('.tnote.is-now')).toContainText('Good honest check-in');
  await expect(page.locator('.chapters__list li.is-now')).toContainText('Midpoint');

  // Chapters navigate the long video.
  await page.locator('.chapters__list').getByRole('button', { name: /:00 Wrap-up and next week/ }).click();
  await expect.poll(() => currentTime(page)).toBe(3120);
  await page.getByRole('button', { name: 'Previous chapter' }).click();
  await expect.poll(() => currentTime(page)).toBe(2040);

  // Zoom in for precise placement.
  await page.getByRole('radiogroup', { name: 'Timeline zoom' }).getByRole('radio', { name: '64×' }).click();
  await expect(page.getByTestId('zoom-span')).toHaveText('About 56 sec across');
  const width = await page.getByTestId('timeline').evaluate((el) => el.getBoundingClientRect().width);
  const view = await page.locator('.tl__scroll').evaluate((el) => el.clientWidth);
  expect(width).toBeGreaterThan(view * 60);
});

test('mark a range, write, edit and resolve a note, then export the notes document', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  await page.locator('.chapters__list').getByRole('button', { name: /:00 Deep work/ }).click();
  await expect.poll(() => currentTime(page)).toBe(2040);

  // In at 0:34:00, out 30 s later.
  await page.keyboard.press('i');
  await video(page).evaluate((v: HTMLVideoElement) => (v.currentTime = 2070));
  await expect(page.getByTestId('timecode')).toContainText('0:34:30');
  await page.keyboard.press('o');
  const composer = page.getByTestId('note-composer');
  await expect(composer.getByLabel('Start time')).toHaveValue('0:34:00');
  await expect(composer.getByLabel('End time (optional)')).toHaveValue('0:34:30');
  await expect(composer.getByLabel('Section name')).toHaveValue('Deep work, in real time');
  await composer.getByLabel('Note').fill('Hold on the hands for two more seconds.');
  await composer.getByRole('button', { name: 'Add note' }).click();
  const note = panel(page).locator('.tnote', { hasText: 'two more seconds' });
  await expect(note).toContainText('0:34:00–0:34:30');

  // Edit and resolve.
  await note.getByRole('button', { name: 'Edit note' }).click();
  await composer.getByLabel('Note').fill('Hold on the hands for three more seconds.');
  await composer.getByRole('button', { name: 'Save note' }).click();
  await expect(note).toHaveCount(0);
  const edited = panel(page).locator('.tnote', { hasText: 'three more seconds' });
  await edited.getByLabel('Resolved').check();
  await expect(edited).toHaveClass(/is-resolved/);

  // Export everything for this cut as one document.
  await page.getByTestId('export-notes').click();
  const doc = page.getByTestId('notes-document');
  await expect(doc).toContainText('Notes on Draft 1');
  await expect(doc.getByRole('heading', { name: 'Deep work, in real time' })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-notes').click()]);
  expect(download.suggestedFilename()).toBe('A quiet morning - long cut - Draft 1 notes.md');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('### Chapters');
  expect(text).toContain('- 0:52:00 Wrap-up and next week');
  expect(text).toContain('- [x] 0:34:00–0:34:30 — Hold on the hands for three more seconds. — Robin');
  expect(text).toContain('- [ ] 0:28:00–0:31:30 — Good honest check-in.');
});

test('drafts: upload with progress, keep every cut, compare, go back, carry feedback forward', async ({ page }) => {
  await open(page, '/studio/proj-market/drafts');
  await expect(page.getByTestId('project-storage')).toHaveText('790 MB');
  await expect(page.getByTestId('cut-history').locator('.hrow[data-cut]')).toHaveCount(2);

  // A file that isn't a video is refused clearly, and nothing changes.
  await page.getByRole('button', { name: 'Add a draft' }).click();
  await page.getByTestId('cut-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
  await expect(page.getByTestId('upload-error')).toContainText('isn’t a video file. Nothing was added.');
  await expect(page.getByTestId('upload-error')).toContainText('Earlier cuts are untouched.');

  // A real video file: Draft 3, made current, Draft 2 kept.
  const bytes = await readFile('public/demo-media/studio/market-draft1.webm');
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft 3');
  await page.getByTestId('cut-file').setInputFiles({ name: 'market-draft3.webm', mimeType: 'video/webm', buffer: bytes });
  await expect(page.getByTestId('upload-done')).toContainText('Draft 3 added and is now the current version. Draft 2 is kept in the history.');
  await page.getByRole('button', { name: 'Done' }).click();
  const rows = page.getByTestId('cut-history').locator('.hrow[data-cut]');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2)).toContainText('Current');
  await expect(rows.nth(2)).toContainText('30 sec · 1 MB');
  await expect(page.getByTestId('project-storage')).toHaveText('791 MB');

  // Rename, then go back to Draft 2 as the current version.
  await rows.nth(2).getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Cut name').fill('Draft 3 — tighter hook');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rows.nth(2)).toContainText('Draft 3 — tighter hook');
  await rows.nth(1).getByRole('button', { name: 'Make current' }).click();
  await expect(rows.nth(1)).toContainText('Current');

  // Compare Draft 1 with the current Draft 2.
  await rows.nth(0).getByRole('button', { name: 'Compare with Draft 2' }).click();
  await expect(page).toHaveURL(/\/compare\?a=c-market-1&b=c-market-2/);
  await expect(page.getByTestId('compare')).toContainText('Draft 2 is 4 sec shorter than Draft 1.');
  await expect(page.getByTestId('compare-video-0')).toHaveJSProperty('duration', 30);
  await expect(page.getByTestId('compare-video-1')).toHaveJSProperty('duration', 26);

  // Earlier feedback from Draft 1 is shown with its own timing, then carried forward deliberately.
  await page.getByRole('tab', { name: 'Review' }).click();
  const earlier = page.getByTestId('earlier-feedback');
  await expect(earlier).toContainText('0:21–0:26 in Draft 1');
  await expect(earlier).toContainText('Replace this shot of the stall');
  await video(page).evaluate((v: HTMLVideoElement) => (v.currentTime = 17));
  await expect(page.getByTestId('timecode')).toContainText('0:17');
  await earlier.getByRole('button', { name: 'Carry to 0:17' }).click();
  await expect(earlier).toHaveCount(0);
  const carried = panel(page).locator('.tnote', { hasText: 'Replace this shot of the stall' });
  await expect(carried).toContainText('0:17–0:22');
  await expect(carried).toContainText('Carried forward');

  // Draft 1 still has the original note at its original time.
  await page.getByRole('radiogroup', { name: 'Cut' }).getByRole('radio', { name: 'Draft 1' }).click();
  await expect(panel(page).locator('.tnote', { hasText: 'Replace this shot' })).toContainText('0:21–0:26');
});

test('archive keeps storage; delete asks first and frees space; approve and use for creations', async ({ page }) => {
  await open(page, '/studio/proj-market/drafts');
  const rows = page.getByTestId('cut-history').locator('.hrow[data-cut]');
  await rows.nth(0).getByRole('button', { name: 'Archive' }).click();
  await expect(rows.nth(0)).toContainText('Archived');
  await expect(page.getByTestId('project-storage')).toHaveText('790 MB');

  // Draft 2 is used by the creations: deleting its cut keeps the file.
  await rows.nth(1).getByRole('button', { name: 'Delete…' }).click();
  await expect(page.getByRole('dialog')).toContainText('The file is kept because it’s also used by');
  await page.getByRole('button', { name: 'Keep it' }).click();

  await rows.nth(0).getByRole('button', { name: 'Delete…' }).click();
  await expect(page.getByTestId('frees')).toHaveText('Frees 410 MB of storage.');
  await page.getByTestId('confirm-delete-cut').click();
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId('project-storage')).toHaveText('380 MB');

  await page.getByRole('tab', { name: 'Review' }).click();
  await page.getByTestId('approve').click();
  await expect(page.getByRole('region', { name: 'Approval' })).toContainText('Draft 2 is approved.');
  await expect(page.getByRole('region', { name: 'Approval' })).toContainText('Posting stays manual');
});

test('storage: add storage shows cost and the new allowance, and charges nothing in the preview', async ({ page }) => {
  await open(page, '/studio');
  await expect(page.getByTestId('storage-used')).toHaveText('268.8 GB');
  await page.getByRole('button', { name: 'Add storage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add storage' });
  await dialog.getByRole('radio', { name: /\+1\.00 TB/ }).check();
  await expect(page.getByTestId('addon-summary')).toContainText('New allowance2.00 TB');
  await expect(page.getByTestId('addon-summary')).toContainText('$10 a month');
  await expect(page.getByTestId('addon-summary')).toContainText('$0 — preview only');
  await expect(dialog).not.toContainText(/card number|password/i);
  await dialog.getByRole('button', { name: 'Add 1.00 TB in preview' }).click();
  await expect(page.getByTestId('storage-meter')).toContainText('of 2.00 TB');
});

test('plan a video from a title only, connected to Ideas', async ({ page }) => {
  await open(page, '/studio');
  await page.getByTestId('plan-video').click();
  await page.getByLabel('Video title').fill('A slow Sunday reset');
  await page.getByTestId('create-plan').click();
  await expect(page).toHaveURL(/\/studio\/proj-.+\/plan$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A slow Sunday reset');
  await page.getByRole('textbox', { name: 'Hook' }).fill('Ten minutes that make Monday easier.');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await page.getByRole('tab', { name: 'Review' }).click();
  await expect(page.getByText('No footage or drafts yet')).toBeVisible();

  // The idea exists in Ideas and links back to its video.
  await page.getByRole('link', { name: 'A slow Sunday reset' }).first().click();
  await expect(page).toHaveURL(/\/ideas\//);
  await expect(page.locator('.idea-head__studio')).toContainText('A slow Sunday reset');
});

test('restricted collaborator: Sam sees only the video for his account and can’t approve or delete', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();

  await goDirect(page, '/studio');
  await expect(page.locator('.vidrow')).toHaveCount(1);
  await expect(page.locator('.vidrow')).toContainText('Night market phrases');

  // A direct link to the long cut is refused.
  await goDirect(page, '/studio/proj-morning');
  await expect(page.getByRole('heading', { name: 'This video isn’t shared with Sam' })).toBeVisible();

  await goDirect(page, '/studio/proj-market');
  await expect(page.getByTestId('approve')).toHaveCount(0);
  await expect(page.getByTestId('mark-moment')).toBeVisible();
  await goDirect(page, '/studio/proj-market/drafts');
  await expect(page.getByRole('button', { name: 'Delete…' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add storage' })).toHaveCount(0);
  await goDirect(page, '/studio/proj-market/plan');
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
  await expect(page.getByText('changing it needs Edit on the whole Space')).toBeVisible();
});

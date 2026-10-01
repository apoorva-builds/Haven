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

/** Wait until the picture at the playhead is decoded, not just requested. */
const settled = (page: Page) =>
  page.waitForFunction(() => {
    const v = document.querySelector<HTMLVideoElement>('[data-testid="studio-video"]');
    return !!v && !v.seeking && v.readyState >= 2;
  });
const goTo = async (page: Page, time: string) => {
  await page.getByLabel('Go to time').fill(time);
  await page.getByLabel('Go to time').press('Enter');
  await settled(page);
};

test('short video: plays smoothly, notes follow playback, one-second steps, notes and markers jump to their second', async ({ page }) => {
  await open(page, '/studio/proj-market');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Night market phrases — vertical');
  await expect(video(page)).toHaveJSProperty('duration', 26);
  await expect(page.getByTestId('timecode')).toContainText('0:00 / 0:26');
  // A short clip never shows an hour.
  await expect(page.locator('.shead')).not.toContainText(/\bhr\b|1:00:00/);
  await expect(panel(page).locator('.tnote.is-now')).toContainText('Hook lands now');

  // One-second steps, by button and keyboard.
  await page.getByRole('button', { name: 'Forward 1 second' }).click();
  await page.getByRole('button', { name: 'Forward 1 second' }).click();
  await expect.poll(() => currentTime(page)).toBe(2);
  await page.locator('body').press('ArrowRight');
  await expect.poll(() => currentTime(page)).toBe(3);
  await page.getByRole('button', { name: 'Back 1 second' }).click();
  await expect.poll(() => currentTime(page)).toBe(2);
  await expect(page.getByTestId('timecode')).toContainText('0:02 / 0:26');

  // Clicking a note jumps to its exact second, and the panel highlights it.
  await panel(page).getByRole('button', { name: 'Jump to 0:06' }).click();
  await expect.poll(() => currentTime(page)).toBe(6);
  await expect(panel(page).locator('.tnote.is-now')).toContainText('Caption overlaps the safe zone');
  // So does its marker on the timeline.
  await page.getByRole('button', { name: /^Note at 0:22: End card/ }).click();
  await expect.poll(() => currentTime(page)).toBe(22);

  // Playing: time advances and the highlight follows into the end-card range.
  await page.getByRole('button', { name: 'Jump to 0:00' }).click();
  await video(page).evaluate((v: HTMLVideoElement) => (v.currentTime = 21.5));
  await page.getByTestId('play').click();
  await expect.poll(() => currentTime(page), { timeout: 5000 }).toBeGreaterThan(22.2);
  await expect(panel(page).locator('.tnote.is-now')).toContainText('End card');
  await expect(panel(page).locator('.tnote.is-now [role="progressbar"]')).toBeVisible();
  await page.getByTestId('play').click();

  // The Notes panel is optional.
  await page.getByTestId('toggle-notes').click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByTestId('toggle-notes').click();
  await expect(panel(page)).toBeVisible();
});

test('one-hour sample: typed times, one-second steps and notes near the beginning, middle and end', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  await expect(page.getByTestId('timecode')).toContainText('/ 1:00:00');
  expect(await video(page).evaluate((v: HTMLVideoElement) => (v.seekable.length ? v.seekable.end(0) : 0))).toBe(3600);

  // Seek straight to a typed time.
  await goTo(page, '00:14:32');
  expect(await currentTime(page)).toBe(872);
  await expect(page.getByTestId('timecode')).toContainText('0:14:32 / 1:00:00');
  await expect(page.locator('.chapters__now')).toHaveText('Tea and the first quiet hour');
  // Other accepted forms, and an honest error past the end.
  await goTo(page, '14:33');
  expect(await currentTime(page)).toBe(873);
  await page.getByLabel('Go to time').fill('01:30:00');
  await page.getByLabel('Go to time').press('Enter');
  await expect(page.getByRole('alert')).toHaveText('This draft is 1:00:00 long.');
  expect(await currentTime(page)).toBe(873);

  // Shift+arrow moves ten seconds; arrows one.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => currentTime(page)).toBe(883);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentTime(page)).toBe(882);

  // Notes at the beginning, middle and end, each at the exact second typed.
  const places = [
    { at: '00:00:05', sec: 5, text: 'Start on the window, not the desk.' },
    { at: '00:30:00', sec: 1800, text: 'Hold this check-in a beat longer.' },
    { at: '00:59:55', sec: 3595, text: 'End screen covers the last line.' },
  ];
  for (const p of places) {
    await goTo(page, p.at);
    expect(await currentTime(page)).toBe(p.sec);
    await page.getByTestId('add-note').click();
    const composer = page.getByTestId('note-composer');
    await expect(composer.getByLabel('Start time')).toHaveValue(p.at.replace(/^00:/, '0:'));
    await composer.getByLabel('Note').fill(p.text);
    await composer.getByRole('button', { name: 'Add note' }).click();
    const note = panel(page).locator('.tnote', { hasText: p.text });
    await expect(note.locator('.tnote__time')).toHaveText(p.at.replace(/^00:/, '0:'));
    // Its marker sits at that second on the timeline.
    const marker = page.getByRole('button', { name: `Note at ${p.at.replace(/^00:/, '0:')}: ${p.text}` });
    const left = await marker.evaluate((el) => parseFloat((el as HTMLElement).style.left));
    expect(left).toBeCloseTo((p.sec / 3600) * 100, 3);
  }

  // From anywhere, each note and each marker returns to its exact second.
  for (const p of places) {
    await goTo(page, '00:20:00');
    await panel(page).locator('.tnote', { hasText: p.text }).getByRole('button', { name: /^Jump to/ }).click();
    await settled(page);
    expect(await currentTime(page)).toBe(p.sec);
    await expect(panel(page).locator('.tnote.is-now')).toContainText(p.text);
    await goTo(page, '00:20:00');
    await page.getByRole('button', { name: new RegExp(`^Note at .*${p.text}`) }).click();
    await settled(page);
    expect(await currentTime(page)).toBe(p.sec);
  }

  // Chapters still navigate the long video; zoom helps precise placement.
  await page.locator('.chapters__list').getByRole('button', { name: /:00 Wrap-up and next week/ }).click();
  await expect.poll(() => currentTime(page)).toBe(3120);
  await page.getByRole('radiogroup', { name: 'Timeline zoom' }).getByRole('radio', { name: '64×' }).click();
  await expect(page.getByTestId('zoom-span')).toHaveText('About 56 sec across');
});

test('scrubbing lands on the second under the pointer, with the time shown while dragging', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  const track = page.getByTestId('timeline');
  await track.scrollIntoViewIfNeeded();
  const box = (await track.boundingBox())!;
  const y = box.y + 40; // the chapter band, clear of note markers
  const at = (f: number) => box.x + box.width * f;
  await page.mouse.move(at(0.1), y);
  await expect(page.locator('.tl__hover')).toHaveText('0:06:00');
  await page.mouse.down();
  await page.mouse.move(at(0.3), y, { steps: 8 });
  await page.mouse.move(at(0.5), y, { steps: 8 });
  await expect(page.locator('.tl__hover')).toHaveText('0:30:00');
  await page.mouse.up();
  await settled(page);
  expect(await currentTime(page)).toBe(1800);
  await expect(page.getByTestId('timecode')).toContainText('0:30:00');
  // Keyboard on the scrubber: one second at a time.
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentTime(page)).toBe(1801);
});

test('on a slow connection, seeking says it is loading instead of looking broken', async ({ page }) => {
  // Throttle the network so the long video arrives slowly.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await open(page, '/studio');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 60 * 1024, uploadThroughput: 60 * 1024 });
  await goDirect(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600, { timeout: 20000 });

  await page.getByLabel('Go to time').fill('00:45:00');
  await page.getByLabel('Go to time').press('Enter');
  await expect(page.getByTestId('player-status')).toContainText(/Loading/);
  await expect(page.getByTestId('timecode')).toContainText('0:45:00');
  await expect(page.getByTestId('stage')).toHaveAttribute('data-state', /loading|seeking|buffering/);

  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect(page.getByTestId('player-status')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId('stage')).toHaveAttribute('data-state', 'ready');
  expect(await currentTime(page)).toBe(2700);
});

test('volume and brightness are viewer-only and never change the file or anyone else’s view', async ({ page }) => {
  await open(page, '/studio/proj-market');
  await expect(video(page)).toHaveJSProperty('duration', 26);
  await page.getByLabel('Volume').fill('0.4');
  await expect.poll(() => video(page).evaluate((v: HTMLVideoElement) => v.volume)).toBeCloseTo(0.4, 2);
  await page.getByRole('button', { name: 'Mute' }).click();
  await expect(video(page)).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Unmute' }).click();

  await page.getByLabel('Brightness (your view only)').fill('1.3');
  await expect(video(page)).toHaveCSS('filter', 'brightness(1.3)');
  await expect(page.getByText('Brightness 130% is only on your screen.')).toBeVisible();
  // The file itself is untouched.
  await expect(video(page)).toHaveAttribute('src', '/demo-media/studio/market-draft2.webm');

  // Remembered for this viewer in this browser…
  await page.reload();
  await expect(video(page)).toHaveCSS('filter', 'brightness(1.3)');
  // …but not for the posted video in the Creation Gallery…
  await goDirect(page, '/gallery/v-tt-pine');
  await expect(page.locator('video').first()).toHaveCSS('filter', 'none');
  // …nor for anyone else.
  await goDirect(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Jonah/ }).click();
  await page.getByRole('button', { name: 'Preview as Jonah' }).click();
  await goDirect(page, '/studio/proj-market');
  await expect(video(page)).toHaveCSS('filter', 'none');
  await expect(page.getByLabel('Brightness (your view only)')).toHaveValue('1');
});

test('pause, note what should change in the next draft, edit, resolve, and export the full list', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  await goTo(page, '0:34:00');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  const composer = page.getByTestId('note-composer');
  await expect(composer.getByLabel('Start time')).toHaveValue('0:34:00');
  await expect(composer.getByLabel('Section name')).toHaveValue('Deep work, in real time');
  await expect(page.getByTestId('tl-pending')).toBeVisible();
  // A note can optionally cover a stretch.
  await composer.getByLabel('End time (optional)').fill('0:34:30');
  await composer.getByLabel('Note').fill('Hold on the hands for two more seconds.');
  await composer.getByRole('button', { name: 'Add note' }).click();
  const note = panel(page).locator('.tnote', { hasText: 'two more seconds' });
  await expect(note).toContainText('0:34:00–0:34:30');

  await note.getByRole('button', { name: 'Edit note' }).click();
  await composer.getByLabel('Note').fill('Hold on the hands for three more seconds.');
  await composer.getByRole('button', { name: 'Save note' }).click();
  await expect(note).toHaveCount(0);
  const edited = panel(page).locator('.tnote', { hasText: 'three more seconds' });
  await edited.getByLabel('Resolved').check();
  await expect(edited).toHaveClass(/is-resolved/);

  await page.getByTestId('export-notes').click();
  const doc = page.getByTestId('notes-document');
  await expect(doc).toContainText('Notes on Draft 1');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-notes').click()]);
  expect(download.suggestedFilename()).toBe('A quiet morning - long cut - Draft 1 notes.md');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('- [x] 0:34:00–0:34:30 — Hold on the hands for three more seconds. — Robin');
  expect(text).toContain('- [ ] 0:28:00–0:31:30 — Good honest check-in.');
  expect(text).toContain('- [x] 0:59:40 — End screen safe area checked.');
});

test('drafts: upload with progress, keep every draft, compare, go back; earlier notes stay at their own times', async ({ page }) => {
  await open(page, '/studio/proj-market/drafts');
  await expect(page.getByTestId('project-storage')).toHaveText('790 MB');
  await expect(page.getByTestId('cut-history').locator('.hrow[data-cut]')).toHaveCount(2);

  // A file that isn't a video is refused clearly, and nothing changes.
  await page.getByRole('button', { name: 'Add a draft' }).click();
  await page.getByTestId('cut-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
  await expect(page.getByTestId('upload-error')).toContainText('isn’t a video file. Nothing was added.');
  await expect(page.getByTestId('upload-error')).toContainText('Earlier drafts are untouched.');

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
  await page.getByLabel('Draft name').fill('Draft 3 — tighter hook');
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
  await earlier.getByRole('button', { name: 'Add here at 0:17' }).click();
  await expect(earlier).toHaveCount(0);
  const carried = panel(page).locator('.tnote', { hasText: 'Replace this shot of the stall' });
  await expect(carried).toContainText('0:17–0:22');
  await expect(carried).toContainText('From an earlier draft');

  // Draft 1 still has the original note at its original time.
  await page.getByRole('radiogroup', { name: 'Draft' }).getByRole('radio', { name: 'Draft 1' }).click();
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
  await expect(page.getByTestId('add-note')).toBeVisible();
  await goDirect(page, '/studio/proj-market/drafts');
  await expect(page.getByRole('button', { name: 'Delete…' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add storage' })).toHaveCount(0);
  await goDirect(page, '/studio/proj-market/plan');
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0);
  await expect(page.getByText('changing it needs Edit on the whole Space')).toBeVisible();
});

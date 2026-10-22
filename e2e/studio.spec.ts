import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/**
 * Video Studio: a review studio, not an editor. Media are bundled samples
 * (vite preview serves byte ranges, so seeking is real). Everything else
 * lasts for the browser session only.
 */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const goDirect = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const video = (page: Page) => page.getByTestId('studio-video');
const currentTime = (page: Page) => video(page).evaluate((v: HTMLVideoElement) => v.currentTime);
const booklet = (page: Page) => page.getByTestId('booklet');
const draftPicker = (page: Page) => page.getByRole('radiogroup', { name: 'Draft' });

/** Wait until the picture at the playhead is decoded, not just requested. */
const settled = (page: Page) =>
  page.waitForFunction(() => {
    const v = document.querySelector<HTMLVideoElement>('[data-testid="studio-video"]');
    return !!v && !v.seeking && v.readyState >= 2;
  });
const settings = async (page: Page) => {
  if ((await page.getByRole('dialog', { name: 'Player settings' }).count()) === 0) await page.getByTestId('player-settings').click();
  return page.getByRole('dialog', { name: 'Player settings' });
};
const goTo = async (page: Page, time: string) => {
  const menu = await settings(page);
  await menu.getByLabel('Go to time').fill(time);
  await menu.getByLabel('Go to time').press('Enter');
  await settled(page);
};
const openBooklet = async (page: Page) => {
  if ((await booklet(page).count()) === 0) await page.getByTestId('booklet-toggle').click();
  await expect(booklet(page)).toBeVisible();
};

test('the default view is the video, with one next action; the booklet is optional and remembered', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3540);
  await expect(draftPicker(page).getByRole('radio', { name: /Draft 2/ })).toHaveAttribute('aria-checked', 'true');
  // Quiet by default: no booklet, no note form, no menu, no markers.
  await expect(booklet(page)).toHaveCount(0);
  await expect(page.getByTestId('note-composer')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Player settings' })).toHaveCount(0);
  await expect(page.locator('.scrub__marker')).toHaveCount(0);
  // One next action.
  await expect(page.getByTestId('upload-final')).toBeVisible();
  await expect(page.getByTestId('booklet-toggle')).toHaveText(/Booklet\s*3 open/);

  // Open the booklet while playing; playback continues.
  await page.getByTestId('play').click();
  await expect.poll(() => currentTime(page)).toBeGreaterThan(0.3);
  await page.getByTestId('booklet-toggle').click();
  await expect(booklet(page)).toBeVisible();
  await expect(video(page)).toHaveJSProperty('paused', false);
  await page.getByTestId('play').click();

  // The choice is remembered for this viewing session.
  await goDirect(page, '/studio');
  await goDirect(page, '/studio/proj-morning');
  await expect(booklet(page)).toBeVisible();
  await booklet(page).getByRole('button', { name: 'Close booklet' }).click();
  await expect(booklet(page)).toHaveCount(0);
  await page.reload();
  await expect(video(page)).toHaveJSProperty('duration', 3540);
  await expect(booklet(page)).toHaveCount(0);
});

test('play and seek a short video: progress bar, precise steps, booklet entries jump to their second', async ({ page }) => {
  await open(page, '/studio/proj-market?cut=c-market-2');
  await expect(video(page)).toHaveJSProperty('duration', 26);
  await expect(page.getByTestId('timecode')).toContainText('0:00 / 0:26');
  await page.getByTestId('play').click();
  await expect.poll(() => currentTime(page), { timeout: 5000 }).toBeGreaterThan(1);
  await page.getByTestId('play').click();

  // Click on the progress bar: lands on the second under the pointer.
  const bar = page.getByTestId('scrubber');
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  await settled(page);
  expect(await currentTime(page)).toBe(13);

  // Shift+arrow is one second; the settings menu has ±1s and shows the exact time.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => currentTime(page)).toBe(14);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentTime(page)).toBe(9);
  const menu = await settings(page);
  await menu.getByRole('button', { name: 'Forward 1 second' }).click();
  await expect.poll(() => currentTime(page)).toBe(10);
  await expect(menu.getByTestId('exact-time')).toHaveText('0:10');
  await page.keyboard.press('Escape');

  // Booklet entries seek to their exact second and the section is highlighted.
  await openBooklet(page);
  await booklet(page).getByRole('button', { name: 'Jump to 0:22' }).click();
  await expect.poll(() => currentTime(page)).toBe(22);
  await expect(booklet(page).locator('.bsec.is-now')).toContainText('End card');
  await booklet(page).getByRole('button', { name: /^Play from Phrases/ }).click();
  await expect.poll(() => currentTime(page)).toBe(3);
  await expect(booklet(page).locator('.bsec.is-now')).toContainText('Phrases');
});

test('the one-hour sample: typed times and notes near the beginning, middle and end land on their exact second', async ({ page }) => {
  await open(page, '/studio/proj-morning?cut=c-morning-1');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  await expect(page.getByTestId('timecode')).toContainText('/ 1:00:00');
  expect(await video(page).evaluate((v: HTMLVideoElement) => (v.seekable.length ? v.seekable.end(0) : 0))).toBe(3600);

  await goTo(page, '00:14:32');
  expect(await currentTime(page)).toBe(872);
  await expect(page.getByTestId('timecode')).toContainText('0:14:32 / 1:00:00');
  const menu = await settings(page);
  await menu.getByLabel('Go to time').fill('01:30:00');
  await menu.getByLabel('Go to time').press('Enter');
  await expect(menu.getByRole('alert')).toHaveText('This draft is 1:00:00 long.');
  expect(await currentTime(page)).toBe(872);
  // Detailed note markers are a secondary option.
  await menu.getByLabel('Show note markers on the progress bar').check();
  await page.keyboard.press('Escape');
  await expect(page.locator('.scrub__marker')).toHaveCount(6);

  const places = [
    { at: '00:00:05', label: '0:00:05', sec: 5, text: 'Start on the window, not the desk.' },
    { at: '00:30:00', label: '0:30:00', sec: 1800, text: 'Hold this check-in a beat longer.' },
    { at: '00:59:55', label: '0:59:55', sec: 3595, text: 'End screen covers the last line.' },
  ];
  for (const p of places) {
    await goTo(page, p.at);
    await page.keyboard.press('Escape');
    expect(await currentTime(page)).toBe(p.sec);
    await expect(page.getByTestId('add-note')).toHaveText(`Add note at ${p.label}`);
    await page.getByTestId('add-note').click();
    const composer = page.getByTestId('note-composer');
    await expect(composer.getByLabel('Note time')).toHaveValue(p.label);
    await composer.getByLabel('What should change').fill(p.text);
    await composer.getByRole('button', { name: 'Save note' }).click();
    await expect(booklet(page).getByRole('status')).toHaveText(`Saved to Draft 1 at ${p.label}.`);
    const note = booklet(page).locator('.bnote', { hasText: p.text });
    await expect(note.locator('.bnote__time')).toHaveText(p.label);
    const marker = page.locator(`.scrub__marker[title="${p.label} · ${p.text}"]`);
    expect(await marker.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBeCloseTo((p.sec / 3600) * 100, 3);
  }
  for (const p of places) {
    await goTo(page, '00:20:00');
    await page.keyboard.press('Escape');
    await booklet(page).locator('.bnote', { hasText: p.text }).getByRole('button', { name: /^Jump to/ }).click();
    await settled(page);
    expect(await currentTime(page)).toBe(p.sec);
  }
  await expect(booklet(page)).toContainText('4 of 9 review items done');
});

test('scrubbing by drag lands on the second under the pointer, with the time shown', async ({ page }) => {
  await open(page, '/studio/proj-morning?cut=c-morning-1');
  await expect(video(page)).toHaveJSProperty('duration', 3600);
  const bar = page.getByTestId('scrubber');
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.1, y);
  await expect(page.locator('.scrub__hover')).toContainText('0:06:00');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, y, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
  await expect(page.locator('.scrub__hover')).toContainText('0:30:00');
  await page.mouse.up();
  await settled(page);
  expect(await currentTime(page)).toBe(1800);
});

test('on a slow connection, seeking says it is loading instead of looking broken', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await open(page, '/studio');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 60 * 1024, uploadThroughput: 60 * 1024 });
  await goDirect(page, '/studio/proj-morning?cut=c-morning-1');
  await expect(video(page)).toHaveJSProperty('duration', 3600, { timeout: 20000 });
  const menu = await settings(page);
  await menu.getByLabel('Go to time').fill('00:45:00');
  await menu.getByLabel('Go to time').press('Enter');
  await expect(page.getByTestId('player-status')).toContainText(/Loading/);
  await expect(page.getByTestId('timecode')).toContainText('0:45:00');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await expect(page.getByTestId('player-status')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId('stage')).toHaveAttribute('data-state', 'ready');
  expect(await currentTime(page)).toBe(2700);
});

test('fullscreen offers Video only and Video + Booklet, with the booklet beside the video', async ({ page }) => {
  await open(page, '/studio/proj-morning?t=1700');
  await expect(video(page)).toHaveJSProperty('duration', 3540);
  await page.getByTestId('fullscreen').click();
  await expect(page.getByTestId('review')).toHaveAttribute('data-fullscreen', 'true');
  const modes = page.getByRole('radiogroup', { name: 'Fullscreen layout' });
  await expect(modes.getByRole('radio', { name: 'Video only' })).toHaveAttribute('aria-checked', 'true');
  await modes.getByRole('radio', { name: 'Video + Booklet' }).click();
  await expect(booklet(page)).toBeVisible();
  // Inside the fullscreen element, beside (not over) the video.
  expect(await page.evaluate(() => !!document.fullscreenElement?.querySelector('[data-testid="booklet"]'))).toBe(true);
  const stage = (await page.getByTestId('stage').boundingBox())!;
  const side = (await booklet(page).boundingBox())!;
  expect(side.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
  await expect(booklet(page).locator('.bsec.is-now')).toContainText('Midpoint');
  // Adding a note works in fullscreen too.
  await page.getByTestId('add-note').click();
  await expect(page.getByTestId('note-composer')).toBeVisible();
  await page.getByTestId('note-composer').getByRole('button', { name: 'Cancel' }).click();
  await modes.getByRole('radio', { name: 'Video only' }).click();
  await expect(booklet(page)).toHaveCount(0);
  await page.getByTestId('fullscreen').click();
  await expect(page.getByTestId('review')).toHaveAttribute('data-fullscreen', 'false');
});

test('tick a review item done, then reopen it; progress stays quiet and honest', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await openBooklet(page);
  await expect(page.getByTestId('booklet-progress')).toContainText('7 of 10 review items done');
  await expect(page.getByTestId('booklet-progress')).toContainText('3 sections ready · 3 need attention');
  await expect(booklet(page)).toContainText('Haven never edits the footage');
  const desk = booklet(page).locator('.bsec', { hasText: 'Setting up the desk' });
  await expect(desk.locator('.bsec__state')).toHaveText('1 open');

  await booklet(page).getByRole('button', { name: 'Mark done: Planner close-up is soft. Use the second take.' }).click();
  await expect(page.getByTestId('booklet-progress')).toContainText('8 of 10 review items done');
  await expect(desk.locator('.bsec__state')).toHaveText('Ready');
  await expect(booklet(page).getByRole('status')).toHaveText('Marked done.');

  await booklet(page).getByRole('button', { name: 'Reopen: Planner close-up is soft. Use the second take.' }).click();
  await expect(page.getByTestId('booklet-progress')).toContainText('7 of 10 review items done');
  await expect(desk.locator('.bsec__state')).toHaveText('1 open');
  // The file is unchanged.
  await expect(video(page)).toHaveAttribute('src', '/demo-media/studio/morning-long-2.webm');
});

test('add a note with an optional range and section, edit it, and export the full list', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await expect(video(page)).toHaveJSProperty('duration', 3540);
  await goTo(page, '3:18');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('add-note')).toHaveText('Add note at 3:18');
  await page.getByTestId('add-note').click();
  const composer = page.getByTestId('note-composer');
  await expect(composer.getByLabel('Note time')).toHaveValue('3:18');
  await composer.getByRole('button', { name: 'Add a time range or section' }).click();
  await expect(composer.getByLabel('Section')).toHaveValue('Setting up the desk');
  await composer.getByLabel('Until (optional)').fill('3:40');
  await composer.getByLabel('What should change').fill('Hold the planner shot two more seconds.');
  await composer.getByRole('button', { name: 'Save note' }).click();
  const note = booklet(page).locator('.bnote', { hasText: 'two more seconds' });
  await expect(note).toContainText('3:18–3:40');
  await expect(note).toContainText('Open');
  await expect(page.getByTestId('booklet-progress')).toContainText('7 of 11 review items done');
  // Notes stay with this draft only.
  await draftPicker(page).getByRole('radio', { name: /Draft 1/ }).click();
  await expect(booklet(page).locator('.bnote', { hasText: 'two more seconds' })).toHaveCount(0);
  await draftPicker(page).getByRole('radio', { name: /Draft 2/ }).click();

  await note.getByRole('button', { name: /^Edit note/ }).click();
  await composer.getByLabel('What should change').fill('Hold the planner shot three more seconds.');
  await composer.getByRole('button', { name: 'Save changes' }).click();
  await expect(booklet(page).locator('.bnote', { hasText: 'three more seconds' })).toContainText('3:18–3:40');

  await page.getByTestId('export-notes').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-notes').click()]);
  expect(download.suggestedFilename()).toBe('A quiet morning - long cut - Draft 2 notes.md');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('- [ ] 3:18–3:40 — Hold the planner shot three more seconds. — Robin');
  expect(text).toContain('- [x] 0:40 — Window shot now opens the video. Keep it.');
});

test('switch drafts: each keeps its own booklet; earlier notes keep their original times', async ({ page }) => {
  await open(page, '/studio/proj-market');
  await expect(draftPicker(page).getByRole('radio')).toHaveText([/Draft 1/, /Draft 2/, /Final/]);
  await expect(draftPicker(page).getByRole('radio', { name: /Final/ })).toHaveAttribute('aria-checked', 'true');
  await openBooklet(page);
  await expect(booklet(page).getByRole('heading', { name: 'Final', exact: true })).toBeVisible();
  await expect(page.getByTestId('publish-checklist')).toBeVisible();

  await draftPicker(page).getByRole('radio', { name: /Draft 1/ }).click();
  await expect(video(page)).toHaveJSProperty('duration', 30);
  await expect(booklet(page).getByRole('heading', { name: 'Draft 1' })).toBeVisible();
  await expect(page.getByTestId('publish-checklist')).toHaveCount(0);
  await expect(booklet(page).locator('.bnote', { hasText: 'Replace this shot' })).toContainText('0:21–0:26');

  await draftPicker(page).getByRole('radio', { name: /Draft 2/ }).click();
  await expect(video(page)).toHaveJSProperty('duration', 26);
  const earlier = page.getByTestId('earlier-feedback');
  await earlier.locator('summary').click();
  await expect(earlier).toContainText('0:21–0:26 in Draft 1');
  await expect(earlier).toContainText('Haven never moves them');
  // Nothing was copied onto Draft 2 automatically.
  await expect(booklet(page).locator('.bsec .bnote', { hasText: 'Replace this shot' })).toHaveCount(0);
  await earlier.getByRole('button', { name: 'See it in Draft 1' }).click();
  await expect(draftPicker(page).getByRole('radio', { name: /Draft 1/ })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => currentTime(page)).toBe(21);
});

test('upload a final video, keep every draft, and mark it ready to publish without claiming a post', async ({ page }) => {
  await open(page, '/studio/proj-morning');
  await page.getByTestId('upload-final').click();
  const dialog = page.getByRole('dialog', { name: /Upload the final video/ });
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Final');
  await dialog.getByRole('button', { name: 'Try with a sample file' }).click();
  await expect(page.getByTestId('upload-done')).toContainText('Final added and is now the current version. Draft 2 is kept in the history.');
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Every draft is still here, and the Final is selected with its own checklist.
  await expect(draftPicker(page).getByRole('radio')).toHaveText([/Original footage/, /Draft 1/, /Draft 2/, /Final/]);
  await expect(draftPicker(page).getByRole('radio', { name: /Final/ })).toHaveAttribute('aria-checked', 'true');
  const checklist = page.getByTestId('publish-checklist');
  await expect(checklist).toContainText('Publishing checklist · Final');
  await expect(checklist).toContainText('For this final upload only. Drafts keep their review booklets.');
  await expect(page.getByTestId('mark-ready')).toBeDisabled();
  await checklist.getByLabel('This is the correct version').check();
  await checklist.getByLabel('Title and caption reviewed').check();
  await checklist.getByLabel('Thumbnail or cover reviewed').check();
  await page.getByTestId('mark-ready').click();
  await expect(checklist).toContainText('Ready to publish');
  await expect(checklist).toContainText('Not posted yet. Haven doesn’t publish');
  await expect(page.getByTestId('ready-badge')).toHaveText(/Final is ready to publish\s*· not posted yet/);
  // The creation is unchanged: still In review, nothing posted.
  await expect(checklist.locator('.pcheck__creation')).toContainText('In review');

  // Draft 2's booklet is intact.
  await draftPicker(page).getByRole('radio', { name: /Draft 2/ }).click();
  await expect(page.getByTestId('booklet-progress')).toContainText('7 of 10 review items done');
  // Unticking a check takes "ready" away.
  await draftPicker(page).getByRole('radio', { name: /Final/ }).click();
  await checklist.getByLabel('Thumbnail or cover reviewed').uncheck();
  await expect(page.getByTestId('mark-ready')).toBeDisabled();
  await expect(page.getByTestId('open-checklist')).toBeVisible();
});

test('a final part-way through its checklist: the next action opens it', async ({ page }) => {
  await open(page, '/studio/proj-market');
  await expect(page.getByTestId('open-checklist')).toHaveText('Finish the publishing checklist');
  await page.getByTestId('open-checklist').click();
  const checklist = page.getByTestId('publish-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByLabel('This is the correct version')).toBeChecked();
  await expect(checklist).toContainText('1 check left.');
  await checklist.getByLabel('Thumbnail or cover reviewed').check();
  await page.getByTestId('mark-ready').click();
  await expect(page.getByTestId('ready-badge')).toBeVisible();
});

test('viewer-only volume and brightness never change the file or anyone else’s view', async ({ page }) => {
  await open(page, '/studio/proj-market?cut=c-market-2');
  await expect(video(page)).toHaveJSProperty('duration', 26);
  await page.locator('.rv__volume').hover();
  await page.getByLabel('Volume').fill('0.4');
  await expect.poll(() => video(page).evaluate((v: HTMLVideoElement) => v.volume)).toBeCloseTo(0.4, 2);
  await page.getByRole('button', { name: 'Mute' }).click();
  await expect(video(page)).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Unmute' }).click();

  const menu = await settings(page);
  await menu.getByLabel('Brightness (your view only)').fill('1.3');
  await expect(video(page)).toHaveCSS('filter', 'brightness(1.3)');
  await expect(page.getByText('Brightness 130% is on your screen only.')).toBeVisible();
  await expect(video(page)).toHaveAttribute('src', '/demo-media/studio/market-draft2.webm');
  await page.reload();
  await expect(video(page)).toHaveCSS('filter', 'brightness(1.3)');
  await goDirect(page, '/gallery/v-tt-pine');
  await expect(page.locator('video').first()).toHaveCSS('filter', 'none');
  await goDirect(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Jonah/ }).click();
  await page.getByRole('button', { name: 'Preview as Jonah' }).click();
  await goDirect(page, '/studio/proj-market');
  await expect(video(page)).toHaveCSS('filter', 'none');
});

test('drafts & final: upload errors, a new draft never replaces one, rename, compare', async ({ page }) => {
  await open(page, '/studio/proj-market/drafts');
  const rows = page.getByTestId('cut-history').locator('.hrow[data-cut]');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(2)).toContainText('Final · publishing checklist');

  await page.getByRole('button', { name: 'Add a draft' }).click();
  await page.getByTestId('cut-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
  await expect(page.getByTestId('upload-error')).toContainText('isn’t a video file. Nothing was added.');
  await expect(page.getByTestId('upload-error')).toContainText('Earlier drafts are untouched.');
  const bytes = await readFile('public/demo-media/studio/market-draft1.webm');
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft 3');
  await page.getByTestId('cut-file').setInputFiles({ name: 'market-draft3.webm', mimeType: 'video/webm', buffer: bytes });
  await expect(page.getByTestId('upload-done')).toContainText('Draft 3 added and is now the current version. Final is kept in the history.');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(draftPicker(page).getByRole('radio')).toHaveText([/Draft 1/, /Draft 2/, /Final/, /Draft 3/]);

  await page.getByRole('tab', { name: 'Drafts & final' }).click();
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(3)).toContainText('30 sec · 1 MB');
  await rows.nth(3).getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Draft name').fill('Draft 3 — tighter hook');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rows.nth(3)).toContainText('Draft 3 — tighter hook');
  await rows.nth(0).getByRole('button', { name: 'Compare with Draft 3 — tighter hook' }).click();
  await expect(page.getByTestId('compare')).toContainText('Draft 3 — tighter hook');
  await expect(page.getByTestId('compare-video-0')).toHaveJSProperty('duration', 30);
});

test('archive keeps storage; deleting a draft asks first and frees its space', async ({ page }) => {
  await open(page, '/studio/proj-market/drafts');
  const rows = page.getByTestId('cut-history').locator('.hrow[data-cut]');
  await expect(page.getByTestId('project-storage')).toHaveText('1.1 GB');
  await rows.nth(0).getByRole('button', { name: 'Archive' }).click();
  await expect(rows.nth(0)).toContainText('Archived');
  await expect(page.getByTestId('project-storage')).toHaveText('1.1 GB');
  // The final is used by the creations: deleting it keeps the file.
  await rows.nth(2).getByRole('button', { name: 'Delete…' }).click();
  await expect(page.getByRole('dialog')).toContainText('The file is kept because it’s also used by');
  await page.getByRole('button', { name: 'Keep it' }).click();
  await rows.nth(0).getByRole('button', { name: 'Delete…' }).click();
  await expect(page.getByTestId('frees')).toHaveText('Frees 410 MB of storage.');
  await page.getByTestId('confirm-delete-cut').click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId('project-storage')).toHaveText('752 MB');
});

test('storage: add storage shows cost and the new allowance, and charges nothing in the preview', async ({ page }) => {
  await open(page, '/studio');
  await page.getByRole('button', { name: 'Add storage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add storage' });
  await dialog.getByRole('radio', { name: /\+1\.00 TB/ }).check();
  await expect(page.getByTestId('addon-summary')).toContainText('New allowance2.00 TB');
  await expect(page.getByTestId('addon-summary')).toContainText('$0 — preview only');
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
  await page.getByRole('tab', { name: 'Review' }).click();
  await expect(page.getByText('No footage or drafts yet')).toBeVisible();
});

test('restricted collaborator: Sam reviews only his video and can’t mark it ready or delete drafts', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();
  await goDirect(page, '/studio');
  await expect(page.locator('.vidrow')).toHaveCount(1);
  await goDirect(page, '/studio/proj-morning');
  await expect(page.getByRole('heading', { name: 'This video isn’t shared with Sam' })).toBeVisible();
  await goDirect(page, '/studio/proj-market');
  await expect(page.getByTestId('add-note')).toBeVisible();
  await page.getByTestId('open-checklist').click();
  await expect(page.getByTestId('mark-ready')).toBeDisabled();
  await expect(page.getByTestId('publish-checklist')).toContainText('Marking ready needs Review on this video.');
  await goDirect(page, '/studio/proj-market/drafts');
  await expect(page.getByRole('button', { name: 'Delete…' })).toHaveCount(0);
});

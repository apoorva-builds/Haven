import { expect, test, type Page } from '@playwright/test';

/**
 * Personal profile: photo and look belong to one person. Preview: saved in
 * this browser; with real sign-in they follow the account to every device.
 */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const goDirect = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const RED = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=', 'base64');
const BLUE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPQiDqBFTEMLQkAFKhSgZfuVK8AAAAASUVORK5CYII=', 'base64');

const openSettings = async (page: Page) => {
  await page.getByTestId('me-menu').click();
  await page.getByRole('menuitem', { name: /Profile & appearance/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Profile & appearance' });
  await expect(dialog).toBeVisible();
  return dialog;
};
const cssVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const topAvatarImg = (page: Page) => page.getByTestId('me-menu').locator('img');

test('upload, replace and remove a profile photo, with an initials fallback', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByTestId('me-menu')).toContainText('R');
  await expect(topAvatarImg(page)).toHaveCount(0);

  let dialog = await openSettings(page);
  await expect(dialog.getByTestId('profile-avatar')).toHaveText('R');
  // Not an image: a clear message, nothing changes.
  await dialog.getByTestId('profile-photo-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(dialog.getByRole('alert')).toHaveText('Choose an image file (JPEG, PNG, HEIC or WebP).');
  await dialog.getByTestId('profile-photo-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: RED });
  await expect(dialog.getByRole('img', { name: 'Your profile photo' })).toBeVisible();
  // Nothing is saved until Save.
  await expect(topAvatarImg(page)).toHaveCount(0);
  await dialog.getByTestId('save-profile').click();
  await expect(dialog).toHaveCount(0);
  await expect(topAvatarImg(page)).toBeVisible();
  // The same photo is used on Today.
  await expect(page.getByRole('button', { name: 'Change your photo' }).locator('img')).toBeVisible();
  const first = await topAvatarImg(page).getAttribute('src');

  // Replace.
  dialog = await openSettings(page);
  await expect(dialog.getByRole('button', { name: 'Replace photo' })).toBeVisible();
  await dialog.getByTestId('profile-photo-input').setInputFiles({ name: 'me2.png', mimeType: 'image/png', buffer: BLUE });
  await dialog.getByTestId('save-profile').click();
  await expect.poll(() => topAvatarImg(page).getAttribute('src')).not.toBe(first);

  // Remembered across sessions on this device.
  await page.reload();
  await expect(topAvatarImg(page)).toBeVisible();

  // Remove: initials come back.
  dialog = await openSettings(page);
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(dialog.getByTestId('profile-avatar')).toHaveText('R');
  await dialog.getByTestId('save-profile').click();
  await expect(topAvatarImg(page)).toHaveCount(0);
  await expect(page.getByTestId('me-menu')).toContainText('R');
});

test('a palette previews across Haven, Cancel goes back, Save keeps it across sessions', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-palette', 'haven');
  const havenFill = await cssVar(page, '--cobalt-fill');

  // Preview, then cancel.
  let dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: /Plum/ }).click();
  await expect(html).toHaveAttribute('data-palette', 'plum');
  await expect(dialog.getByRole('status')).toHaveText('Previewing across Haven. Save to keep it, or Cancel to go back.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(html).toHaveAttribute('data-palette', 'haven');
  expect(await cssVar(page, '--cobalt-fill')).toBe(havenFill);

  // Choose Harbor, dark, and save.
  dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: /Harbor/ }).click();
  await dialog.getByRole('radio', { name: 'Dark' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await dialog.getByTestId('save-profile').click();
  await expect(html).toHaveAttribute('data-palette', 'harbor');
  expect(await cssVar(page, '--cobalt-fill')).toBe('#1f6f85');
  await page.getByTestId('me-menu').click();
  await expect(page.getByRole('menuitem', { name: /Profile & appearance/ })).toContainText('Harbor · dark');
  await page.keyboard.press('Escape');

  // A new session on this device: applied before first paint.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe('harbor');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // The same look on the calendar and in the Video Studio.
  for (const path of ['/calendar', '/studio/proj-morning']) {
    await goDirect(page, path);
    await expect(html).toHaveAttribute('data-palette', 'harbor');
    // Page, navigation and the selected section all use the palette.
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(15, 21, 23)');
    await expect(page.locator('.sidebar .nav__item.active')).toHaveCSS('background-color', 'rgb(22, 52, 61)');
  }
  await expect(page.getByTestId('upload-final')).toHaveCSS('background-color', 'rgb(31, 111, 133)');
  // In the Studio, the booklet sits on the palette's surface.
  await page.getByTestId('booklet-toggle').click();
  await expect(page.getByTestId('booklet')).toHaveCSS('background-color', 'rgb(24, 34, 38)');

  // The quick toggle changes only appearance; the palette stays.
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveAttribute('data-palette', 'harbor');
});

test('personalisation belongs to one person: other members keep their own look and content is unchanged', async ({ page }) => {
  await open(page, '/');
  // The work on the page, leaving out the person's own photo.
  const work = () => page.evaluate(() => {
    const m = document.querySelector('main')!.cloneNode(true) as HTMLElement;
    m.querySelectorAll('.pphoto').forEach((e) => e.remove());
    return m.innerText;
  });
  const before = await work();
  const dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: /Plum/ }).click();
  await dialog.getByTestId('profile-photo-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: RED });
  await dialog.getByTestId('save-profile').click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
  // The work itself is the same.
  expect(await work()).toBe(before);

  // Jonah sees his own look and no one else's photo.
  await goDirect(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Jonah/ }).click();
  await page.getByRole('button', { name: 'Preview as Jonah' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'haven');
  await expect(topAvatarImg(page)).toHaveCount(0);
  await expect(page.getByTestId('me-menu')).toContainText('J');
  // Robin can't change Jonah's settings while previewing.
  await expect(page.getByTestId('theme-toggle')).toBeDisabled();
  await page.getByTestId('me-menu').click();
  await expect(page.getByRole('menuitem', { name: /Profile & appearance/ })).toBeDisabled();
  await expect(page.getByText('Their photo and look are theirs to change.')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Back to your view' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
  await expect(topAvatarImg(page)).toBeVisible();
});

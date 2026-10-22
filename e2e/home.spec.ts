import { expect, test, type Page } from '@playwright/test';

/**
 * The public homepage at /: its navigation reaches the sample sign-in,
 * the sign-up preview and the workspace demo, and unfinished features are
 * labelled as planned rather than presented as live.
 */

const nav = (page: Page) => page.getByRole('banner');

test('homepage: sections, honest labels and no invented prices', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /One idea\.\s*Every version\./ })).toBeVisible();
  for (const name of [
    'Everything a video needs, from first clip to final post.',
    'One idea. Every platform.',
    'For the films you’ll still want to watch in fifty years.',
    'Review every cut like it’s the premiere.',
    'Where your files and your work finally meet',
    'Two plans, each with one clear purpose.',
    'Built to be trusted with what you can’t replace.',
    'Frequently asked',
    'Creators belong here.',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  // Prices aren't set, and nothing pretends otherwise.
  await expect(page.locator('#pricing')).not.toContainText(/[$£€]\s?\d/);
  await expect(page.locator('#pricing').getByText('Price to be announced')).toHaveCount(2);
  await expect(page.getByText('Payments aren’t active. No card details are requested anywhere in this preview.')).toBeVisible();
  // Security features are planned, not claimed.
  await expect(page.getByText('Haven isn’t live yet, so these are the protections we’re building toward', { exact: false })).toBeVisible();
  // FAQ answers open and close.
  const faq = page.locator('details', { hasText: 'Can I use Haven today?' });
  await faq.locator('summary').click();
  await expect(faq.getByText('Not yet. Haven is in an early preview.', { exact: false })).toBeVisible();
});

test('section links scroll to Features, Creator, Personal and Pricing', async ({ page }) => {
  await page.goto('/');
  for (const [label, id] of [
    ['Features', 'features'],
    ['Creator', 'creator'],
    ['Personal', 'personal'],
    ['Pricing', 'pricing'],
  ] as const) {
    await nav(page).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
});

test('Sign in opens the sample sign-in; Get started opens the sign-up preview', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Haven' })).toBeVisible();

  await page.goto('/');
  await nav(page).getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByText('Sign-up preview · UI only')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Haven Creator/ })).toBeChecked();
});

test('a plan’s Preview sign-up preselects it; the preview creates nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Preview sign-up for Haven Personal' }).click();
  await expect(page).toHaveURL(/\/signup\?plan=personal$/);
  await expect(page.getByRole('radio', { name: /Haven Personal/ })).toBeChecked();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await page.getByLabel('Your name').fill('Robin');
  await page.getByLabel('Email').fill('robin@example.com');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('heading', { name: 'That’s the start of Haven Personal' })).toBeFocused();
  await expect(page.getByText('nothing was created or sent', { exact: false })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  expect(stored).not.toContain('robin@example.com');
  await page.getByRole('link', { name: /Explore the workspace demo/ }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test('the workspace demo is one click away and its pages still work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Explore the workspace demo' }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.t-hello__h')).toBeVisible();
  // Today in the sidebar is /app; the other workspace routes keep their paths.
  await page.locator('.sidebar').getByRole('link', { name: 'Calendar' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.locator('.sidebar').getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  // A creator feature card opens its page in the demo.
  await page.goto('/');
  await page.getByRole('link', { name: /Open Video Studio/ }).click();
  await expect(page).toHaveURL(/\/studio$/);
});

test('the product showcase switches between real workspace views', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('tabpanel');
  await expect(page.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('img.is-active')).toHaveAttribute('src', '/marketing/showcase-today-light.webp');
  await page.getByRole('tab', { name: 'Library' }).click();
  await expect(panel.locator('img.is-active')).toHaveAttribute('src', '/marketing/showcase-library-light.webp');
  await expect(panel.getByRole('img', { name: /Raw Library/ })).toBeVisible();
  // Arrow keys move between views.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Calendar' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(panel.locator('img.is-active')).toHaveAttribute('src', '/marketing/showcase-accounts-light.webp');
});

test('the homepage opens light, and its dark edition doesn’t change the workspace', async ({ page }) => {
  // Even on a device set to dark, the homepage opens in its light edition.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const home = page.locator('.home');
  await expect(home).not.toHaveClass(/home--dark/);
  await expect(home).toHaveCSS('background-color', 'rgb(251, 248, 244)');
  const workspaceTheme = await page.locator('html').getAttribute('data-theme');

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(home).toHaveClass(/home--dark/);
  await expect(home).toHaveCSS('background-color', 'rgb(21, 17, 16)');
  await expect(page.getByRole('tabpanel').locator('img.is-active')).toHaveAttribute('src', '/marketing/showcase-today-dark.webp');
  // The workspace appearance is untouched.
  await expect(page.locator('html')).toHaveAttribute('data-theme', workspaceTheme!);
  // Remembered on this device.
  await page.reload();
  await expect(page.locator('.home')).toHaveClass(/home--dark/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('.home')).not.toHaveClass(/home--dark/);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the menu opens, links work and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const menu = page.getByRole('button', { name: 'Open menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('#hnav-panel');
    await panel.getByRole('link', { name: 'Pricing' }).click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/#pricing$/);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await panel.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

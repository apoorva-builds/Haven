import { expect, test } from '@playwright/test';

/**
 * The sample sign-in is UI only: it walks through every step, keeps choices
 * when going back, never writes the secrets anywhere, and ends on Today.
 */
test('sample sign-in: five steps, back keeps choices, secrets never stored', async ({ page }) => {
  await page.goto('/login?instant');
  await expect(page.getByText('Sample sign-in · UI only')).toBeVisible();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();

  // 1. Email and password, validated, with show/hide.
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Enter an email address, like name@example.com.')).toBeVisible();
  await page.getByLabel('Email').fill('robin@example.com');
  const pw = page.getByLabel('Password', { exact: true });
  await pw.fill('not-a-real-pass');
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Continue/ }).click();

  // 2. A signature colour is required to continue, and survives Back.
  await expect(page.getByRole('heading', { name: 'Choose your signature colour' })).toBeFocused();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled();
  await page.getByRole('radio', { name: 'Champagne rose' }).click();
  await expect(page.getByRole('radio', { name: 'Champagne rose' })).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByLabel('Email')).toHaveValue('robin@example.com');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByRole('radio', { name: 'Champagne rose' })).toBeChecked();
  await page.getByRole('button', { name: /Continue/ }).click();

  // 3. The passkey step is a labelled simulation.
  await expect(page.getByText('Demo · no camera or biometrics used')).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled();
  await page.getByRole('button', { name: /Simulate Face ID \/ passkey/ }).click();
  await expect(page.getByText('Confirmed (demo)')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();

  // 4. Personal sentence: hidden by default.
  const sentence = page.getByLabel('Personal sentence', { exact: true });
  await expect(sentence).toHaveAttribute('type', 'password');
  await sentence.fill('short');
  await page.getByRole('button', { name: /Finish/ }).click();
  await expect(page.getByText('Write at least 12 characters.')).toBeVisible();
  await sentence.fill('a quiet morning at the desk');
  await page.getByRole('button', { name: /Finish/ }).click();

  // 5. Welcome, then the existing dashboard.
  await expect(page.getByRole('heading', { name: 'Welcome to Haven, robin' })).toBeVisible();
  await expect(page.getByText('Signature colour: Champagne rose')).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  expect(stored).not.toContain('not-a-real-pass');
  expect(stored).not.toContain('quiet morning');
  await page.getByRole('button', { name: /Go to your dashboard/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.t-hello__h')).toBeVisible();
});

test('the About panel links to the sample sign-in', async ({ page }) => {
  await page.goto('/app?instant');
  await page.locator('.topbar__preview button').first().click();
  await page.getByRole('link', { name: 'Try the sample sign-in' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in to Haven' })).toBeVisible();
});

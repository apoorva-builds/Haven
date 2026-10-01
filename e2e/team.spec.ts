import { expect, test, type Page } from '@playwright/test';

/**
 * Team & access preview. These checks cover the preview's behaviour only:
 * access filters this browser tab and is not security.
 */

const open = (page: Page, path: string) => page.goto(`${path}${path.includes('?') ? '&' : '?'}instant`);
const nav = (page: Page, name: string) => page.getByRole('complementary', { name: 'Primary' }).getByRole('link', { name, exact: true }).click();
/** Follow a pasted link without reloading, so the session (and preview) stays. */
const goDirect = (page: Page, path: string) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test('workspace menu opens Team & access instead of placeholder items', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('complementary', { name: 'Primary' }).getByRole('button', { name: /Haven Preview/ }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /Billing|Storage|Settings|Team & roles/ })).toHaveCount(0);
  await menu.getByRole('menuitem', { name: /Team & access/ }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Team & access');
  await expect(page.getByRole('note')).toContainText('It isn’t security yet');
  await expect(page.getByRole('note')).toContainText('never asks for social account passwords');
});

test('members and the access editor by Space and account', async ({ page }) => {
  await open(page, '/team');
  const list = page.locator('.member-list');
  for (const name of ['Robin', 'Priya', 'Jonah', 'Sam', 'Alex']) await expect(list).toContainText(name);
  await expect(list.getByRole('button', { name: /Alex/ })).toContainText('Invited');

  await list.getByRole('button', { name: /Robin/ }).click();
  await expect(page.locator('.access-editor')).toContainText('Full access to every Space');
  await expect(page.locator('.access-table')).toHaveCount(0);

  await list.getByRole('button', { name: /Sam/ }).click();
  const table = page.getByRole('table', { name: /Access for Sam/ });
  await expect(table.getByRole('checkbox', { name: 'Edit & upload: TikTok @pinepaper.sample' })).toBeChecked();
  await expect(table.getByRole('checkbox', { name: 'Review & approve: TikTok @pinepaper.sample' })).not.toBeChecked();
  await expect(table.getByRole('checkbox', { name: 'View: Instagram @littleatlas.sample' })).not.toBeChecked();

  // A whole-Space grant covers the Space's accounts, shown as included.
  await table.getByRole('checkbox', { name: 'View: Little Atlas (whole Space)' }).check();
  const included = table.getByRole('checkbox', { name: 'View: Instagram @littleatlas.sample, included with the whole Space' });
  await expect(included).toBeChecked();
  await expect(included).toBeDisabled();
  await expect(list.getByRole('button', { name: /Sam/ })).toContainText('Little Atlas (whole Space)');
  await table.getByRole('checkbox', { name: 'View: Little Atlas (whole Space)' }).uncheck();
  await expect(list.getByRole('button', { name: /Sam/ })).not.toContainText('Little Atlas');
});

test('inviting someone lists a pending invitation without sending anything', async ({ page }) => {
  await open(page, '/team');
  await page.getByRole('button', { name: 'Invite person' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite a person' });
  await expect(dialog.getByText('Preview · nothing is sent')).toBeVisible();
  await dialog.getByLabel('Email').fill('kai@example.com');
  await dialog.getByLabel('Name (optional)').fill('Kai');
  await dialog.getByRole('button', { name: 'Little Atlas' }).click();
  await dialog.getByRole('button', { name: 'Add invitation' }).click();
  const row = page.locator('.member-list').getByRole('button', { name: /Kai/ });
  await expect(row).toContainText('Invited');
  await expect(row).toContainText('Little Atlas (whole Space)');
});

test('previewing as a restricted collaborator hides other work, including direct links and files', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();

  const bar = page.getByRole('status').filter({ hasText: 'Previewing as' });
  await expect(bar).toContainText('Previewing as Sam');
  await expect(bar).toContainText('It isn’t security');
  await expect(page.locator('.task__title', { hasText: 'Tighten the TikTok hook to two seconds' })).toBeVisible();

  await nav(page, 'Creation Gallery');
  await expect(page.locator('.ctile')).toHaveCount(2);
  await expect(page.locator('.ctile[data-version="v-ig-atlas"]')).toHaveCount(0);

  await nav(page, 'Ideas');
  await expect(page.locator('.idea-row')).toHaveCount(2);

  await nav(page, 'Raw Library');
  await expect(page.getByText('Desk timelapse — raw.mov')).toHaveCount(0);
  await expect(page.getByText('Hook & CTA bank.md')).toHaveCount(0);

  // Direct links to work that isn't shared.
  await goDirect(page, '/gallery/v-yt-pine');
  await expect(page.getByRole('heading', { name: 'This creation isn’t shared with Sam' })).toBeVisible();
  await goDirect(page, '/ideas/desk-setup');
  await expect(page.getByRole('heading', { name: 'This idea isn’t shared with Sam' })).toBeVisible();

  // A shared creation opens, with only the actions Sam may take.
  await goDirect(page, '/ideas/market-phrases/versions?v=v-tt-pine');
  await expect(page.getByRole('tab', { name: /Versions/ })).toBeVisible();
  await expect(page.locator('.vrow')).toHaveCount(1);
  const status = page.getByLabel('Version status');
  await expect(status.locator('option', { hasText: 'Posted' })).toHaveAttribute('disabled', '');
  await expect(status.locator('option', { hasText: 'Editing' })).not.toHaveAttribute('disabled');
  await expect(page.getByText(/Recording this post as live needs Publish access/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as posted' })).toHaveCount(0);

  // Sam can edit but not approve: Ready to post stays out of reach on a planned version.
  await goDirect(page, '/ideas/reading-list/versions?v=v-tt-pine-books');
  await expect(page.getByLabel('Version status').locator('option', { hasText: 'Ready to post' })).toHaveAttribute('disabled', '');
  await expect(page.getByLabel('Version status').locator('option', { hasText: 'In review' })).not.toHaveAttribute('disabled');

  await goDirect(page, '/team');
  await expect(page.getByRole('heading', { name: 'Only the owner and admins manage access' })).toBeVisible();
  await bar.getByRole('button', { name: 'Back to your view' }).click();
  await expect(bar).toHaveCount(0);
  await nav(page, 'Creation Gallery');
  await expect(page.locator('.ctile')).toHaveCount(11);
});

test('every edit follows the previewed person’s capabilities, including uploads and tasks', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Jonah/ }).click();
  await page.getByRole('button', { name: 'Preview as Jonah' }).click();

  // Instagram @littleatlas.sample: Jonah can edit this version, not approve it, and not the Little Atlas idea itself.
  await goDirect(page, '/ideas/market-phrases/versions?v=v-ig-atlas');
  const caption = page.getByRole('textbox', { name: 'Caption (English)' });
  await expect(caption).toBeEditable();
  await expect(page.getByLabel('Version status').locator('option', { hasText: 'Ready to post' })).toHaveAttribute('disabled', '');
  await expect(page.getByLabel('Idea status')).toBeDisabled();
  await expect(page.locator('.vrow')).toHaveCount(3); // ig-atlas, plus the two Pine & Paper versions from his Space

  // Files on the Little Atlas idea: visible through his versions, but no upload into that Space.
  await page.getByRole('tab', { name: /Assets/ }).click();
  await expect(page.getByText('Adding files here needs Edit & upload on this idea’s Space.')).toBeVisible();
  await expect(page.getByText('Market walk — raw (1).mov')).toHaveCount(0);

  // Tasks: only the versions he can edit, and assignees who can see them.
  await page.getByRole('tab', { name: /Tasks/ }).click();
  const target = page.getByLabel('Version');
  await expect(target.locator('option', { hasText: 'Whole idea' })).toHaveCount(0);
  await expect(page.getByLabel('Owner').locator('option', { hasText: 'Alex' })).toHaveCount(0);

  // In his own Space he can upload and change the idea.
  await goDirect(page, '/ideas/desk-setup/assets');
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible();
  await expect(page.getByLabel('Idea status')).toBeEnabled();
  await page.getByRole('button', { name: 'Back to your view' }).click();
});

test('an account-only collaborator gets only their own controls, and linked files stay hidden', async ({ page }) => {
  await open(page, '/team');
  await page.locator('.member-list').getByRole('button', { name: /Sam/ }).click();
  await page.getByRole('button', { name: 'Preview as Sam' }).click();

  await goDirect(page, '/ideas/market-phrases/versions?v=v-tt-pine');
  await expect(page.getByRole('textbox', { name: 'Caption (English)' })).toBeEditable();
  await expect(page.getByLabel('Idea status')).toBeDisabled();
  // The finished-video picker lists only files Sam can open.
  const picker = page.getByLabel('Finished video for @pinepaper.sample');
  await expect(picker.locator('option', { hasText: 'Quiet morning' })).toHaveCount(0);

  await goDirect(page, '/library?q=Desk%20timelapse');
  await expect(page.getByText('Desk timelapse — raw.mov')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload' })).toHaveCount(0);

  await goDirect(page, '/links');
  await expect(page.getByRole('form', { name: 'Save a link' })).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

/**
 * Captures review screenshots of key screens in both themes on desktop and
 * phone. Output: docs/screenshots/<theme>-<device>-<screen>.jpg
 * Run with: npm run screenshots
 */
const screens = [
  { name: 'today', path: '/' },
  { name: 'ideas', path: '/ideas' },
  { name: 'idea-versions', path: '/ideas/slow-mornings/versions?v=v-ig-studio' },
  { name: 'idea-assets', path: '/ideas/slow-mornings/assets' },
  { name: 'accounts', path: '/accounts' },
  { name: 'account-videos', path: '/accounts/tt-main' },
  { name: 'library-videos', path: '/library?kind=final' },
  { name: 'calendar', path: '/calendar' },
  { name: 'library', path: '/library' },
  { name: 'links', path: '/links' },
];

const devices = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];

test.skip(!!process.env.CI, 'Screenshots are generated on demand for design review.');

for (const theme of ['light', 'dark'] as const) {
  for (const device of devices) {
    test.describe(`${theme} ${device.name}`, () => {
      test.use({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.isMobile, deviceScaleFactor: device.isMobile ? 2 : 1 });

      for (const screen of screens) {
        test(screen.name, async ({ page }) => {
          await page.addInitScript((t) => localStorage.setItem('haven.theme', t), theme);
          const sep = screen.path.includes('?') ? '&' : '?';
          await page.goto(`${screen.path}${sep}instant`);
          await expect(page.locator('main h1').first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          // Let in-page players show their first frame.
          await page
            .waitForFunction(() => [...document.querySelectorAll('video')].every((v) => v.readyState >= 2), null, { timeout: 5_000 })
            .catch(() => {});
          await page.screenshot({ path: `docs/screenshots/${theme}-${device.name}-${screen.name}.jpg`, type: 'jpeg', quality: 82 });
        });
      }
    });
  }
}

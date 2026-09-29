import { expect, test } from '@playwright/test';

/**
 * Before/after captures for design review of the Creation Gallery and the
 * version screen. Run with COMPARE_OUT=<folder> npm run screenshots.
 * Output: docs/redesign/<folder>/<theme>-<device>-<screen>.jpg
 */
const out = process.env.COMPARE_OUT;
test.skip(!out, 'Set COMPARE_OUT to capture before/after screenshots.');

const screens = [
  { name: 'gallery', path: '/gallery' },
  { name: 'version', path: '/ideas/market-phrases/versions?v=v-ig-atlas' },
];
const devices = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];

for (const theme of ['light', 'dark'] as const) {
  for (const device of devices) {
    test.describe(`${theme} ${device.name}`, () => {
      test.use({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.isMobile, deviceScaleFactor: device.isMobile ? 2 : 1 });
      for (const screen of screens) {
        test(screen.name, async ({ page }) => {
          await page.addInitScript((t) => localStorage.setItem('haven.theme', t), theme);
          await page.goto(`${screen.path}${screen.path.includes('?') ? '&' : '?'}instant`);
          await expect(page.locator('main h1').first()).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => [...document.querySelectorAll('video')].every((v) => v.readyState >= 2), null, { timeout: 5_000 }).catch(() => {});
          await page.screenshot({ path: `docs/redesign/${out}/${theme}-${device.name}-${screen.name}.jpg`, type: 'jpeg', quality: 82 });
        });
      }
    });
  }
}

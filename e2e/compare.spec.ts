import { expect, test } from '@playwright/test';

/**
 * Before/after captures for design review of the Creation Gallery and the
 * version screen. Run with COMPARE_OUT=<folder> npm run screenshots.
 * Output: docs/redesign/<folder>/<theme>-<device>-<screen>.jpg
 */
const out = process.env.COMPARE_OUT;
test.skip(!out, 'Set COMPARE_OUT to capture before/after screenshots.');

const only = process.env.COMPARE_SCREENS?.split(',');
const onlyDevice = process.env.COMPARE_DEVICES?.split(',');
const allScreens = [
  { name: 'ideas', path: '/ideas', fullPage: true },
  { name: 'gallery', path: '/gallery', fullPage: true },
  { name: 'version', path: '/ideas/market-phrases/versions?v=v-ig-atlas' },
];
const screens = only ? allScreens.filter((s) => only.includes(s.name)) : allScreens;
const allDevices = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true },
];
const devices = onlyDevice ? allDevices.filter((d) => onlyDevice.includes(d.name)) : allDevices;

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
          // Bring lazy images in before a full-page capture.
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
          });
          await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5_000 }).catch(() => {});
          await page.waitForFunction(() => [...document.querySelectorAll('video')].every((v) => v.readyState >= 2), null, { timeout: 5_000 }).catch(() => {});
          await page.screenshot({ path: `docs/redesign/${out}/${theme}-${device.name}-${screen.name}.jpg`, type: 'jpeg', quality: 82, fullPage: 'fullPage' in screen });
        });
      }
    });
  }
}

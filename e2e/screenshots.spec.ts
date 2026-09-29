import { expect, test } from '@playwright/test';

/**
 * Captures review screenshots of key screens in both themes on desktop and
 * phone. Output: docs/screenshots/<theme>-<device>-<screen>.jpg
 * Run with: npm run screenshots
 */
const screens: { name: string; path: string; click?: string }[] = [
  { name: 'gallery', path: '/gallery' },
  { name: 'gallery-info', path: '/gallery', click: 'About Post status' },
  { name: 'about-preview', path: '/gallery', click: 'About this preview' },
  { name: 'gallery-account', path: '/gallery?account=yt-pine' },
  { name: 'gallery-account-stale', path: '/gallery?account=ig-atlas' },
  { name: 'creation', path: '/gallery/v-ig-atlas' },
  { name: 'creation-posted', path: '/gallery/v-yt-pine-spots' },
  { name: 'library', path: '/library' },
  { name: 'today', path: '/' },
  { name: 'ideas', path: '/ideas' },
  { name: 'idea-versions', path: '/ideas/market-phrases/versions?v=v-ig-atlas' },
  { name: 'calendar', path: '/calendar' },
]

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
          if (screen.click) {
            // dispatchEvent avoids Playwright scrolling the button under the sticky header.
            await page.getByRole('button', { name: new RegExp(screen.click) }).first().dispatchEvent('click');
            await page.waitForTimeout(400); // let smooth scroll and the open animation settle
          }
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

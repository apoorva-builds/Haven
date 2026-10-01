import { defineConfig, devices } from '@playwright/test';

/**
 * Flow checks and review screenshots run against the production build
 * (`vite preview`). Run `npm run build` first; `npm run check` does both.
 *
 * If a matching Playwright browser isn't installed (e.g. in a locked-down
 * container), point PLAYWRIGHT_CHROMIUM_EXECUTABLE at any Chromium binary.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions,
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', testMatch: /(flows|team|today|calendar)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'], launchOptions } },
    { name: 'screenshots', testMatch: /(screenshots|compare)\.spec\.ts/, use: { ...devices['Desktop Chrome'], launchOptions } },
  ],
});

// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ path: '../.env' });

const baseURL = process.env.VITE_BASE_URL || 'http://localhost:5174';

/**
 * E2E configuration for NEXO Landing Page Creator.
 * - Runs in a visible browser (headless: false) so the user can watch.
 * - Uses one browser context per worker to avoid cross-test contamination.
 * - Captures traces and screenshots on failure for systematic debugging.
 * - Uses generous timeouts because the real Kimi bridge can be slow.
 */
module.exports = defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false, // one LP generation at a time to avoid resource contention
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  timeout: 240_000,
  expect: {
    timeout: 30_000,
  },

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './playwright-report' }],
    ['json', { outputFile: './test-results/results.json' }],
  ],

  use: {
    baseURL,
    headless: false,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Slow down actions slightly so the user can follow the automation
    launchOptions: {
      slowMo: 100,
    },

    // Single-context semantics: one page per test, no extra tabs
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },

  projects: [
    {
      name: 'chromium-visible',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
      },
    },
  ],

  webServer: [
    // We expect the servers to be running already; these entries only verify health.
    {
      command: 'node -e "setInterval(()=>{},1000)"',
      url: 'http://localhost:3460/api/nexo-lp/health',
      timeout: 10_000,
      reuseExistingServer: true,
    },
    {
      command: 'node -e "setInterval(()=>{},1000)"',
      url: 'http://localhost:5174',
      timeout: 10_000,
      reuseExistingServer: true,
    },
  ],
});

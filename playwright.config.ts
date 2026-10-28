import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  fullyParallel: true,
  workers: 2, // each worker owns one browser process
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'en', trace: 'retain-on-failure' },
  // One browser keeps the suite light. Run Safari too with: WEBKIT=1 npx playwright test
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : [])
  ],
  webServer: { command: 'node scripts/serve-built.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false }
});

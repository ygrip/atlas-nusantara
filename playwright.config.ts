import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'en', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: { command: 'node scripts/serve-built.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false }
});

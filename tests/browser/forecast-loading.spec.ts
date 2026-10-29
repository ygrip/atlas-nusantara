import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

test('every forecast caller waits for load, even when the weather panel mounts earlier', async ({ page }) => {
  let releaseImage!: () => void;
  const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
  await page.route('**/illustrations/hero/pinisi*.webp', async route => {
    await imageGate;
    await route.continue();
  });
  await page.addInitScript(() => {
    const state = window as Window & { forecastFetches: boolean[] };
    state.forecastFetches = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (new URL(url, location.href).pathname.endsWith('/forecast.json')) {
        state.forecastFetches.push(document.readyState === 'complete');
      }
      return originalFetch(input, init);
    };
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#weather-tab-current')).toBeAttached();
    expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
    expect(await page.evaluate(() => (window as Window & { forecastFetches: boolean[] }).forecastFetches)).toEqual([]);
  } finally {
    releaseImage();
  }
  await page.waitForLoadState('load');
  await expect.poll(() => page.evaluate(() => (window as Window & { forecastFetches: boolean[] }).forecastFetches.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as Window & { forecastFetches: boolean[] }).forecastFetches.every(Boolean))).toBe(true);
});

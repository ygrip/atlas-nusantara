import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

for (const scale of [1, 2]) {
  test.describe(`ornaments at ${scale}x density`, () => {
    test.use({ deviceScaleFactor: scale });
    test('only decodes the display-density cutouts and motion strips', async ({ page }) => {
      const images: string[] = [];
      page.on('request', request => { if (request.url().includes('/illustrations/hero/')) images.push(request.url()); });
      await page.goto('/');
      await expect(page.locator('.ornament-tiger')).toBeEnabled();
      const sizes = await page.locator('.cutout, .motion-strip').evaluateAll(elements => elements.map(element => {
        const image = element as HTMLImageElement;
        return { source: image.currentSrc, natural: image.naturalWidth, rendered: image.getBoundingClientRect().width };
      }));
      expect(sizes).toHaveLength(14);
      expect(new Set(images).size).toBe(14);
      for (const image of sizes) {
        expect(image.natural).toBeGreaterThan(0);
        if (scale === 1) expect(image.source).toContain('-1x.webp');
        else expect(image.source).not.toContain('-1x.webp');
      }
    });
  });
}

test('startup and hero clicks do not fetch unused destinations or hidden history/table code', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('.ornament-tiger')).toBeEnabled();
  await page.locator('.ornament-tiger').click();
  await expect(page.locator('.ornament-tiger')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForLoadState('networkidle');
  expect(requests.filter(url => /destinations\/index|ProvinceTable|WeatherHistoryChart|WeatherPlaceCard/.test(url))).toEqual([]);
  const scriptBytes = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => entry.name.endsWith('.js'))
    .reduce((total, entry) => total + (entry as PerformanceResourceTiming).decodedBodySize, 0));
  expect(scriptBytes, 'Hero interaction must not prewarm the large Three.js bundle').toBeLessThan(500_000);
  await page.keyboard.press('Escape');
  await page.locator('#weather-tab-history').click();
  await expect(page.locator('.history-table')).toBeVisible();
  await expect.poll(() => requests.some(url => url.includes('WeatherHistoryChart'))).toBe(true);
});

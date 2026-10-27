import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function holdStartupLocation(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true,
    value: { getCurrentPosition(success: PositionCallback) {
      Object.assign(window, { finishStartupLocation: () => success({ coords: { latitude: -8.4095, longitude: 115.1889 } } as GeolocationPosition) });
    } } }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.route(/https:\/\/(?:thumb|upload)\.wikimedia\.org\//, route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"/>'
  }));
});

for (const [name, coordinates, code] of [
  ['inside Bali', { latitude: -8.4095, longitude: 115.1889 }, '51'],
  ['outside Indonesia in Singapore', { latitude: 1.3521, longitude: 103.8198 }, '31']
] as const) {
  test(`startup ${name} requests only province ${code} static data`, async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(coordinates);
    const shards = new Set<string>();
    const nationalRequests: string[] = [];
    const destinationApis: string[] = [];
    context.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/data/destinations/provinces/')) shards.add(url.pathname);
      if (url.pathname === '/data/destinations/national.json') nationalRequests.push(url.pathname);
      if (url.hostname === 'sisparnas.kemenpar.go.id' || url.pathname.startsWith('/api/destinations')) destinationApis.push(url.href);
    });
    await page.goto('/');
    await expect(page.locator('#destination-province')).toHaveValue(code, { timeout: 10000 });
    await expect(page.locator('.destination-table tbody tr')).toHaveCount(25);
    expect([...shards]).toEqual(['/data/destinations/provinces/' + code + '.json']);
    expect(nationalRequests).toEqual([]);
    expect(destinationApis).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('nusantara:current-location:v1'))).toBeNull();
  });
}

test('valid destination data does not depend on city-directory JSON', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -8.4095, longitude: 115.1889 });
  await page.route('**/data/admin-2025/cities/51.json?*', route => route.fulfill({ status: 404, body: '{}' }));
  await page.goto('/');
  await expect(page.locator('#destination-province')).toHaveValue('51');
  await expect(page.locator('.destination-table tbody tr')).toHaveCount(25);
});

test('an explicit province link takes priority over device location', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -8.4095, longitude: 115.1889 });
  await page.goto('/?region=35');
  await expect(page.locator('#destination-province')).toHaveValue('35');
  await expect(page.locator('.destination-table tbody tr')).toHaveCount(25);
});

test('denied location falls back to Jakarta', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { configurable: true,
    value: { getCurrentPosition(_success: PositionCallback, failure: PositionErrorCallback) { failure({ code: 1 } as GeolocationPositionError); } } }));
  await page.goto('/');
  await expect(page.locator('#destination-province')).toHaveValue('31');
  await expect(page.getByRole('status').filter({ hasText: 'Showing Jakarta because your location is outside Indonesia or unavailable.' })).toBeVisible();
});

test('a late location callback cannot overwrite a province the user selected', async ({ page }) => {
  await holdStartupLocation(page);
  await page.goto('/');
  await expect(page.locator('#destination-province option[value="32"]')).toHaveCount(1);
  await page.locator('#destination-province').selectOption('32');
  await expect(page.locator('.destination-table tbody tr')).toHaveCount(25);
  await page.evaluate(async () => {
    (window as Window & { finishStartupLocation: () => void }).finishStartupLocation();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await expect(page.locator('#destination-province')).toHaveValue('32');
  await expect(page).toHaveURL(/region=32/);
});

test('startup location cannot overwrite an unsaved place chosen in the saved-places form', async ({ page }) => {
  await holdStartupLocation(page);
  await page.goto('/');
  await page.locator('#province-code').selectOption('32.73');
  await page.evaluate(() => (window as Window & { finishStartupLocation: () => void }).finishStartupLocation());
  await expect(page.locator('#destination-province')).toHaveValue('51');
  await expect(page.locator('#province-code')).toHaveValue('32.73');
  await page.locator('.places-form button').click();
  await expect(page.locator('.weather-place')).toContainText('Kota Bandung');
});

test('returning to the province cancels delayed deep-city restoration', async ({ page }) => {
  let releaseCities: () => void = () => {};
  const citiesReady = new Promise<void>(resolve => { releaseCities = resolve; });
  await page.route('**/data/admin-2025/cities/32.json?*', async route => {
    await citiesReady;
    await route.continue();
  });
  await page.goto('/?region=32.73');
  await expect(page.locator('#destination-province')).toHaveValue('32');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'Jawa Barat', exact: true }).click();
  releaseCities();
  await page.getByRole('button', { name: /^Weather(?: BMKG)?$/ }).click();
  await expect(page.locator('.region-list li')).toHaveCount(27);
  await expect(page.locator('.atlas-breadcrumb')).not.toContainText('Kota Bandung');
  await expect(page).toHaveURL(/region=32$/);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
  test(`table remains keyboard-scrollable without document overflow at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('nusantara:theme', 'dark'));
    await page.goto('/?region=35');
    await expect(page.locator('.destination-table tbody tr')).toHaveCount(25);
    const scroll = page.locator('.destination-table-scroll');
    await scroll.focus();
    await expect(scroll).toBeFocused();
    const layout = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
    expect(layout.document).toBeLessThanOrEqual(layout.width + 1);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
}

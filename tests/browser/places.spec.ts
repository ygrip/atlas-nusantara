import { expect, test } from './fixtures';
import { choosePlace } from './layers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en')); });

test('saved city cards show dated weather and survive reload without provider requests', async ({ page }) => {
  const providers: string[] = [];
  page.on('request', request => { if (/bmkg\.go\.id/.test(request.url())) providers.push(request.url()); });
  await page.goto('/');
  await choosePlace(page, 'Kota Bandung');
  await page.locator('.places-form button[type="submit"]').click();
  const card = page.locator('.weather-place').filter({ hasText: 'Kota Bandung' });
  await expect(card.locator('.current-weather')).toBeVisible();
  await expect(card.locator('.hourly-weather > div')).toHaveCount(4);
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open in atlas' }).click();
  await expect(page).toHaveURL(/region=32\.73/);
  await card.getByRole('button', { name: 'Remove Kota Bandung' }).click();
  await expect(page.locator('.weather-place')).toHaveCount(0);
  expect(providers).toEqual([]);
});

test('current device location is saved separately, rounded and restored', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -6.2088, longitude: 106.8456 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use device location' }).click();
  await expect(page.locator('.device-location')).toContainText('-6.209, 106.846');
  await expect(page.locator('.device-location .current-weather')).toBeVisible();
  const stored = await page.evaluate(() => ({ current: JSON.parse(localStorage.getItem('nusantara:current-location:v1') ?? '{}'), pins: JSON.parse(localStorage.getItem('nusantara:pins:v1') ?? '[]') }));
  expect(stored.current).toMatchObject({ lat: -6.209, lng: 106.846, type: 'coordinates' });
  expect(stored.pins).toEqual([]);
  await page.reload();
  await expect(page.locator('.device-location')).toContainText('Your location');
});

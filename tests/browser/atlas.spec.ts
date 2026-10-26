import { expect, test, type Page } from '@playwright/test';

const locales = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];
const localeStorageKey = 'PARAGLIDE_LOCALE';

async function useEnglish(page: Page) {
  await page.addInitScript(key => localStorage.setItem(key, 'en'), localeStorageKey);
}

async function openAtlas(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('.region-list li')).toHaveCount(37);
}

test.describe('historical atlas and locations', () => {
  test('renders disclaimer, all locales and unavailable verified-boundary state', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await expect(page.getByText('Not an emergency alert service. Follow official advisories.').first()).toBeVisible();
    await expect(page.locator('#locale-picker option')).toHaveCount(13);
    await expect(page.getByText('Verified boundaries are not available yet.')).toBeVisible();
    await expect(page.locator('.region-list li')).toHaveCount(37);
  });

  test('searches small-island provinces, opens province and city list, then returns to national level', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.getByRole('searchbox').fill('KEPULAUAN RIAU');
    await page.getByRole('button', { name: /KEPULAUAN RIAU 21/ }).click();
    await expect(page.locator('.atlas-breadcrumb')).toContainText('KEPULAUAN RIAU');
    await expect(page.locator('.region-list li').first()).toBeVisible();
    await expect(page.locator('.directory-count')).toContainText('City / regency');
    await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National' }).click();
    await expect(page.locator('.region-list li')).toHaveCount(37);
  });

  test('opens a province from the schematic tile map and highlights its tile', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await expect(page.locator('.tile')).toHaveCount(37);
    await page.getByRole('button', { name: 'JAWA BARAT (32)' }).click();
    await expect(page).toHaveURL(/region=32$/);
    await expect(page.locator('.atlas-breadcrumb')).toContainText('JAWA BARAT');
    await expect(page.locator('.directory-count')).toContainText('27');
    await expect(page.getByRole('button', { name: 'JAWA BARAT (32)' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('province table filters by island group and its popup opens the province in the atlas', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const table = page.locator('#provinces');
    await expect(table.locator('tbody tr')).toHaveCount(37);
    await table.getByRole('button', { name: 'Papua', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(5);
    await table.getByRole('button', { name: 'Details · PAPUA SELATAN' }).click();
    const dialog = page.getByRole('dialog', { name: 'PAPUA SELATAN' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-list li')).toHaveCount(4);
    await dialog.getByRole('button', { name: 'Open in atlas' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/region=93$/);
    await expect(page.locator('.atlas-breadcrumb')).toContainText('PAPUA SELATAN');
  });

  test('sticky section navigation jumps to page sections', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const navigation = page.getByRole('navigation', { name: 'Page sections' });
    await expect(navigation.getByRole('link')).toHaveCount(6);
    await navigation.getByRole('link', { name: 'Sources' }).click();
    await expect(page).toHaveURL(/#sources$/);
    await expect(page.locator('.masthead')).toBeInViewport();
    await expect(page.locator('#sources-heading')).toBeInViewport();
  });

  test('adds, persists and removes a region pin', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.getByRole('button', { name: 'Pin region' }).click();
    await expect(page.locator('.pin')).toContainText('JAWA BARAT');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nusantara:pins:v1') ?? '[]'))).toContainEqual(expect.objectContaining({ code: '32', type: 'region' }));
    await page.reload();
    await expect(page.locator('.pin')).toContainText('JAWA BARAT');
    await page.getByRole('button', { name: 'Remove JAWA BARAT' }).click();
    await expect(page.locator('.pin')).toHaveCount(0);
  });

  test('ignores malformed saved pins without breaking the preferences view', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
    await page.addInitScript(() => localStorage.setItem('nusantara:pins:v1', JSON.stringify([
      { id: 'region:999', type: 'region', code: '999', name: 'Bad', addedAt: 'yesterday' },
      { id: 'geo:999,1', type: 'coordinates', lat: 999, lng: 1, name: 'Bad', addedAt: new Date().toISOString() }
    ])));
    await page.goto('/');
    await expect(page.locator('.empty')).toContainText('No saved locations yet.');
  });

  test('requests geolocation from a user click and stores only rounded coordinates', async ({ page, context }) => {
    await useEnglish(page);
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -6.2088, longitude: 106.8456 });
    await openAtlas(page);
    await page.getByRole('button', { name: 'Use device location' }).click();
    await expect(page.locator('.pin')).toContainText('-6.209, 106.846');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nusantara:pins:v1') ?? '[]'));
    expect(saved[0]).toMatchObject({ type: 'coordinates', lat: -6.209, lng: 106.846 });
  });

  test('reports denied geolocation and does not add a pin', async ({ page, context }) => {
    await useEnglish(page);
    await context.clearPermissions();
    await openAtlas(page);
    await page.getByRole('button', { name: 'Use device location' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Unable to read device location.' })).toBeVisible();
    await expect(page.locator('.pin')).toHaveCount(0);
  });

  test('keeps notification permission separate from subscription setup', async ({ page, context, browserName }) => {
    await useEnglish(page);
    if (browserName === 'webkit') await page.addInitScript(() => Reflect.deleteProperty(window, 'Notification'));
    else await page.addInitScript(() => {
      // Exercise granted UI independently of headless OS notification support.
      Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
      Notification.requestPermission = async () => 'granted';
    });
    await openAtlas(page);
    if (browserName === 'webkit') await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeDisabled();
    else await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeEnabled();
    await expect(page.getByText('Notification permission is not an active alert subscription.')).toBeVisible();
  });

  test('switches and persists each supported locale', async ({ page }) => {
    for (const locale of locales) {
      await page.goto('/');
      await page.locator('#locale-picker').selectOption(locale);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), localeStorageKey)).toBe(locale);
      await page.reload();
      await expect(page.locator('#locale-picker')).toHaveValue(locale);
    }
  });

  test('keeps the layout within 375px and uses a static map with reduced motion', async ({ page }) => {
    await useEnglish(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAtlas(page);
    const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
    await expect(page.locator('.boundary-pending')).toBeVisible();
    const transition = await page.locator('.boundary-pending').evaluate(node => getComputedStyle(node).transitionDuration);
    expect(transition.split(',').every(value => Number.parseFloat(value) === 0)).toBeTruthy();
  });

  test('uses the SPA fallback for a deep link and serves a cached shell offline', async ({ page, context }) => {
    await useEnglish(page);
    await page.goto('/offline-check/child');
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service workers unavailable');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();
    await context.setOffline(true);
    const offlineResponse = await page.goto('/offline-check/new-path');
    expect(offlineResponse?.ok()).toBeTruthy();
    await expect(page.getByRole('searchbox')).toBeVisible();
  });
});

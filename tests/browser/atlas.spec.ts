import { expect, test, type Page } from '@playwright/test';

const locales = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];
const localeStorageKey = 'PARAGLIDE_LOCALE';

async function useEnglish(page: Page) {
  await page.addInitScript(key => localStorage.setItem(key, 'en'), localeStorageKey);
}

async function openAtlas(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Weather(?: BMKG)?$/ }).click();
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('.region-list li')).toHaveCount(38);
}

test.describe('2025 atlas and locations', () => {
  test('renders disclaimer, all locales and the 38-province directory', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await expect(page.getByText('Not an emergency alert service. Follow official advisories.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
    await expect(page.locator('.language-grid button')).toHaveCount(13);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(38);
    await expect(page.locator('.region-list li')).toHaveCount(38);
  });

  test('searches small-island provinces, opens province and city list, then returns to national level', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.getByRole('searchbox').fill('Kepulauan Riau');
    await page.getByRole('button', { name: /Kepulauan Riau 21/ }).click();
    await expect(page.locator('.atlas-breadcrumb')).toContainText('Kepulauan Riau');
    await expect(page.locator('.region-list li').first()).toBeVisible();
    await expect(page.locator('.directory-count')).toContainText('City / regency');
    await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National' }).click();
    await expect(page.locator('.region-list li')).toHaveCount(38);
  });

  test('opens a province from its real polygon and selects a city', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(38);
    await page.locator('path[data-code="32"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/region=32$/);
    await expect(page.locator('.atlas-breadcrumb')).toContainText('Jawa Barat');
    await expect(page.locator('.directory-count')).toContainText('27');
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(27);
    await page.locator('path[data-code="32.01"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('path[data-code="32.01"]')).toHaveClass(/\bselected\b/);
    await expect(page).toHaveURL(/region=32\.01$/);
  });

  test('province table filters by island group and its popup opens the province in the atlas', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const table = page.locator('#provinces');
    await expect(table.locator('tbody tr')).toHaveCount(38);
    await table.getByRole('button', { name: 'Papua', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(6);
    await table.getByRole('button', { name: 'Details · Papua Selatan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Papua Selatan' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-columns li')).toHaveCount(4);
    await dialog.getByRole('button', { name: 'Open in atlas' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/region=93$/);
    await expect(page.locator('.atlas-breadcrumb')).toContainText('Papua Selatan');
  });

  test('sorts the province table, shows the island charts and splits the popup into kabupaten and kota', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const table = page.locator('#provinces');
    const total = table.getByRole('columnheader', { name: /Total/ });
    await total.getByRole('button').click();
    await expect(total).toHaveAttribute('aria-sort', 'descending');
    await expect(table.locator('tbody tr').first()).toContainText('Jawa Timur');
    await total.getByRole('button').click();
    await expect(total).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('.island-chart tbody tr')).toHaveCount(7);
    await expect(page.locator('.region-split')).toContainText('514');
    await table.getByRole('button', { name: 'Details \u00b7 Jawa Barat' }).click();
    const dialog = page.getByRole('dialog', { name: 'Jawa Barat' });
    await expect(dialog.locator('.dialog-columns section').nth(0).locator('li')).toHaveCount(18);
    await expect(dialog.locator('.dialog-columns section').nth(1).locator('li')).toHaveCount(9);
  });

  test('sticky section navigation jumps to page sections', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const navigation = page.getByRole('navigation', { name: 'Page sections' });
    await expect(navigation.getByRole('link')).toHaveCount(5);
    await navigation.getByRole('link', { name: 'Support' }).click();
    await expect(page).toHaveURL(/#support$/);
    await expect(page.locator('.masthead')).toBeInViewport();
    await expect(page.locator('#support h2')).toBeInViewport();
  });

  test('adds, persists and removes a region pin', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.locator('#province-code').selectOption('32');
    await page.getByRole('button', { name: 'Save place' }).click();
    await expect(page.locator('.pin')).toContainText('Jawa Barat');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nusantara:pins:v1') ?? '[]'))).toContainEqual(expect.objectContaining({ code: '32', type: 'region' }));
    await page.reload();
    await expect(page.locator('.pin')).toContainText('Jawa Barat');
    await page.getByRole('button', { name: 'Remove Jawa Barat' }).click();
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
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nusantara:current-location:v1') ?? '{}'));
    expect(saved).toMatchObject({ type: 'coordinates', lat: -6.209, lng: 106.846 });
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
      await page.locator('.language-trigger').click();
      await page.locator(`.language-grid button[lang="${locale}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect.poll(() => page.evaluate(key => localStorage.getItem(key), localeStorageKey)).toBe(locale);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
  });

  test('keeps the layout within 375px and uses a static map with reduced motion', async ({ page }) => {
    await useEnglish(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAtlas(page);
    const sizes = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(sizes.body).toBeLessThanOrEqual(sizes.viewport);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(38);
    const transition = await page.locator('.atlas-map path[data-code]').first().evaluate(node => getComputedStyle(node).transitionDuration);
    expect(transition.split(',').every(value => Number.parseFloat(value) === 0)).toBeTruthy();
  });

  test('uses the SPA fallback for a deep link and serves a cached shell offline', async ({ page, context }) => {
    await useEnglish(page);
    await page.goto('/?region=96');
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service workers unavailable');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();
    await context.setOffline(true);
    const offlineResponse = await page.goto('/?region=32');
    expect(offlineResponse?.ok()).toBeTruthy();
    await expect(page.locator('.masthead .brand')).toBeVisible();
    await expect(page.locator('.destination-explorer')).toBeVisible();
  });
});

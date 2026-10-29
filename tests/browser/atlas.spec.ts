import { expect, test, type Page } from './fixtures';
import { choosePlace, openProvinceDetails } from './layers';

const locales = ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL'];

async function useEnglish(page: Page) {
}

async function openAtlas(page: Page) {
  await page.goto('/');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
}

test.describe('2025 atlas and locations', () => {
  test('weather table and details show forecast, latitude and longitude', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    const headers = page.locator('.region-table thead th');
    await expect(headers).toContainText(['Code', 'Province', 'Weather', 'Lat', 'Lon']);
    const jakarta = page.locator('.region-table tbody tr', { hasText: 'Daerah Khusus Ibukota Jakarta' });
    await expect(jakarta.locator('td.numeric').first()).toHaveText(/^-6\.\d{2}$/);
    await expect(jakarta.locator('td.numeric').nth(1)).toHaveText(/^106\.\d{2}$/);
    await expect(jakarta.locator('td.region-cell').first()).toContainText('°C');
    await jakarta.getByRole('button').click();
    const details = page.locator('.selected-region');
    await expect(details).toContainText('Daerah Khusus Ibukota Jakarta');
    await expect(details).toContainText('Lat');
    await expect(details).toContainText('Temperature');
    await expect(details).toContainText('Cloud cover');
  });

  test('renders exploration copy, all locales and the 38-province directory', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await expect(page.locator('.hero-copy')).toContainText('Get to know Indonesia');
  await expect(page.locator('.hero-copy .notice')).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
    await expect(page.locator('.language-grid button')).toHaveCount(13);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(38);
    await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  });

  test('searches small-island provinces, opens province and city list, then returns to national level', async ({ page }) => {
    await useEnglish(page);
    await openAtlas(page);
    await page.getByRole('searchbox').fill('Kepulauan Riau');
    await page.getByRole('button', { name: /Kepulauan Riau 21/ }).click();
    await expect(page.locator('.atlas-breadcrumb')).toContainText('Kepulauan Riau');
    await expect(page.locator('.region-table tbody tr').first()).toBeVisible();
    await expect(page.locator('.directory-count')).toContainText('City / regency');
    await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National' }).click();
    await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
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
    const table = page.locator('#provinces .province-table');
    await openProvinceDetails(page);
    await expect(table.locator('tbody tr')).toHaveCount(38);
    await table.locator('.group-filter').getByRole('button', { name: 'Papua', exact: true }).click();
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
    const table = page.locator('#provinces .province-table');
    await expect(page.locator('.island-chart tbody tr')).toHaveCount(7);
    await expect(page.locator('.region-split')).toContainText('514');
    await openProvinceDetails(page);
    const total = table.getByRole('columnheader', { name: /Total/ });
    await total.getByRole('button').click();
    await expect(total).toHaveAttribute('aria-sort', 'descending');
    await expect(table.locator('tbody tr').first()).toContainText('Jawa Timur');
    await total.getByRole('button').click();
    await expect(total).toHaveAttribute('aria-sort', 'ascending');
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
    await choosePlace(page, 'Jawa Barat');
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
    // Cleared permissions may leave Safari waiting for a native prompt, not denied.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition(_success: PositionCallback, reject?: PositionErrorCallback) {
          reject?.({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        }
      } });
    });
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
    else await expect(page.getByRole('button', { name: 'Disable notifications' })).toBeEnabled();
    await expect(page.getByText('Live alerts are not connected yet. Turning notifications off here does not revoke browser permission.', { exact: true })).toHaveCount(1);
  });

  test('gives each locale its own path and switches every text in place, without reloading', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
    const hero = page.locator('.hero-copy p');
    const english = await hero.textContent();
    const seen = new Set([english]);
    for (const locale of ['id', 'th', 'zh-SG']) {
      await page.locator('.language-trigger').click();
      await page.locator(`.language-grid button[lang="${locale}"]`).click();
      await expect(page).toHaveURL(new RegExp('/' + locale + '/?$'));
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      // Hero, skip link, section nav and table headers all use messages that must follow the URL.
      await expect(hero).not.toHaveText(english ?? '');
      seen.add(await hero.textContent());
      await expect(page.locator('.section-nav a').nth(1)).not.toHaveText('Provinces');
    }
    expect(seen.size).toBe(4);
    // The window object survives only if no full page load happened.
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
    await page.locator('.language-trigger').click();
    await page.locator('.language-grid button[lang="en"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(hero).toHaveText(english ?? '');
  });

  test('opens a locale path directly and keeps legal pages in that language', async ({ page }) => {
    await page.goto('/id/terms');
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.locator('.legal-links a').first()).toHaveAttribute('href', '/id/terms');
    await page.goto('/zh-SG/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-SG');
  });

  test('blocks page zoom but leaves zoom gestures to the map', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-map-zoom]').first().waitFor({ state: 'attached' });
    const result = await page.evaluate(() => {
      const pageTarget = document.querySelector('.masthead') as Element;
      const mapTarget = document.querySelector('[data-map-zoom]') as Element;
      const ctrlWheel = (target: Element) => {
        const event = new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const ctrlPlus = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, cancelable: true, bubbles: true });
      document.body.dispatchEvent(ctrlPlus);
      return { pageWheel: ctrlWheel(pageTarget), mapWheel: ctrlWheel(mapTarget), keyboard: ctrlPlus.defaultPrevented };
    });
    expect(result).toEqual({ pageWheel: true, mapWheel: false, keyboard: true });
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
    await expect(page.locator('.region-directory')).toBeVisible();
  });
});

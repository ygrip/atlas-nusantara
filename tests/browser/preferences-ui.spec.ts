import { expect, test } from './fixtures';
import { openProvinceDetails } from './layers';

const notificationNote = 'Live alerts are not connected yet. Turning notifications off here does not revoke browser permission.';
test.use({ serviceWorkers: 'block' });

test('granted notifications can be disabled persistently without pretending to revoke browser permission', async ({ page }) => {
  await page.addInitScript(() => {
    // Headless Chromium may report denied despite grantPermissions; exercise granted UI independently of OS support.
    Object.defineProperty(Notification, 'permission', { get: () => 'granted', configurable: true });
    Notification.requestPermission = async () => 'granted';
    const state = window as Window & { notificationUnsubscribes: number; notificationCloses: number };
    state.notificationUnsubscribes = 0;
    state.notificationCloses = 0;
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: async () => ({
      pushManager: { getSubscription: async () => ({ unsubscribe: async () => { state.notificationUnsubscribes++; return true; } }) },
      getNotifications: async () => [{ close: () => { state.notificationCloses++; } }]
    }) });
  });
  await page.goto('/');
  const button = page.locator('.notification-settings button');
  await expect(button).toHaveText('Disable notifications');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveText('Enable notifications');
  await expect(button).toBeEnabled();
  expect(await page.evaluate(() => Notification.permission)).toBe('granted');
  expect(await page.evaluate(() => ({
    unsubscribed: (window as Window & { notificationUnsubscribes: number }).notificationUnsubscribes,
    closed: (window as Window & { notificationCloses: number }).notificationCloses
  }))).toEqual({ unsubscribed: 1, closed: 1 });
  await expect(page.getByText(notificationNote, { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(button).toHaveText('Enable notifications');
  await button.click();
  await expect(button).toHaveText('Disable notifications');
  await expect(page.getByText(notificationNote, { exact: true })).toHaveCount(1);
});

for (const outcome of ['unfilled', 'blocked', 'stalled'] as const) {
  test(`automatic advertising collapses a ${outcome} placement`, async ({ page }) => {
    await page.route('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js*', route => {
      if (outcome === 'blocked') return route.abort();
      let body = 'window.adsbygoogle = { push: function () {} };';
      if (outcome === 'unfilled') body = 'window.adsbygoogle = { push: function () { document.querySelector("ins[data-ad-slot]").dataset.adStatus = "unfilled"; } };';
      return route.fulfill({ contentType: 'application/javascript', body });
    });
    if (outcome === 'stalled') await page.clock.install();
    await page.goto('/');
    await expect(page.locator('ins[data-ad-slot]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Load advertisement' })).toHaveCount(0);
    if (outcome === 'stalled') {
      await expect(page.locator('#nusantara-adsense')).toHaveCount(0);
      await page.clock.fastForward(31_000);
      await expect(page.locator('.network-ad-slot')).toBeVisible();
      await page.locator('.network-ad-slot').scrollIntoViewIfNeeded();
      await expect(page.locator('.network-ad-slot')).toBeInViewport();
      await expect(page.locator('#nusantara-adsense')).toHaveCount(1);
      await page.clock.fastForward(31_000);
    } else {
      await page.locator('.network-ad-slot').scrollIntoViewIfNeeded();
    }
    await expect(page.locator('.network-ad-slot')).toBeHidden();
    await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  });
}

for (const [size, path] of [[64, '/brand/favicon-64.png'], [192, '/icon-192.png'], [256, '/brand/logo-256.png'], [512, '/icon-512.png']] as const) {
  test(`${size}px brand PNG has transparent edges and visible artwork`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async ({ size, path }) => {
      const image = new Image();
      image.src = path;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Canvas is unavailable');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, size, size).data;
      const corners = [3, (size - 1) * 4 + 3, (size * (size - 1)) * 4 + 3, (size * size - 1) * 4 + 3];
      return { width: image.naturalWidth, height: image.naturalHeight, transparentCorners: corners.every(index => pixels[index] === 0), visibleArt: pixels.some((value, index) => index % 4 === 3 && value > 0) };
    }, { size, path });
    expect(result).toEqual({ width: size, height: size, transparentCorners: true, visibleArt: true });
    await expect(page.locator('.brand-logo')).toHaveAttribute('src', '/brand/logo-256.png');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`province names have substantial clay silhouettes in ${colorScheme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await openProvinceDetails(page);
    const icons = page.locator('.province-name .province-silhouette');
    await expect(icons).toHaveCount(38);
    const first = icons.first();
    await first.scrollIntoViewIfNeeded();
    const bounds = await first.boundingBox();
    expect({ width: bounds?.width, height: bounds?.height }).toEqual({ width: 76, height: 54 });
    await expect(first.locator('.silhouette-top')).toHaveAttribute('d', /^M/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.province-table .table-scroll').screenshot({ path: `test-results/province-clay-${colorScheme}.png` });
  });
}

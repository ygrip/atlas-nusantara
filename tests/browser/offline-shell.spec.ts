import { expect, test } from './fixtures';

test('the bounded install cache can reload the atlas and province directory offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cachedPaths = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('nusantara-'));
    const cache = await caches.open(names[names.length - 1]);
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(cachedPaths).toContain('/200.html');
  expect(cachedPaths.some(path => path.startsWith('/og/'))).toBe(false);
  // Add a saved place only after installation: its lazy card was never mounted online.
  await page.evaluate(() => localStorage.setItem('nusantara:pins:v1', JSON.stringify([
    { id: 'region:51', type: 'region', code: '51', name: 'Bali', addedAt: new Date().toISOString() }
  ])));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Atlas Nusantara', exact: true })).toBeVisible();
  await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  await expect(page.locator('.pin')).toContainText('Bali');
  await page.locator('#province-explorer-tab-provinces').click();
  await expect(page.locator('.province-table tbody tr')).toHaveCount(38);
  await page.goto('/offline-missing-place', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'This place is not on the map.' })).toBeVisible();
});

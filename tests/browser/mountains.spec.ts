import { expect, test } from './fixtures';
import { chooseLayer } from './layers';

test('mountain directory and keyboard pins open a detail popup without replacing disaster layers', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.route('**/w/api.php?**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"query":{"pages":{}}}'
  }));
  await page.goto('/');
  await chooseLayer(page, 'Mountains');
  await expect(page).toHaveURL(/layer=mountains/);
  await expect(page.locator('.mountain-list button').first()).toBeVisible();
  await page.locator('.mountain-list button').first().click();
  const popup = page.locator('dialog.map-dialog[open]');
  await expect(popup.locator('.mountain-detail')).toContainText('not a live safety alert');
  await expect(popup.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', /geoservices\.big\.go\.id/);
  await expect(popup.getByRole('button', { name: 'Share' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const pin = page.locator('.overlay-pin').first();
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(popup.locator('.mountain-detail')).toBeVisible();
  await page.keyboard.press('Escape');
  await chooseLayer(page, 'Disaster reports');
  await expect(page.locator('.mountain-detail')).toHaveCount(0);
  await page.locator('.layer-picker-trigger').click();
  await expect(page.locator('.layer-option').filter({ hasText: 'Weather hazards' })).toBeVisible();
});

test('layer picker filters by name or source and defaults to weather', async ({ page }) => {
  // Measure sticky geometry, not the dialog's finite entrance animation.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.goto('/');
  await expect(page.locator('.layer-picker-trigger')).toContainText('Weather');
  await page.locator('.layer-picker-trigger').click();
  const dialog = page.locator('dialog.map-dialog[open]');
  await page.setViewportSize({ width: 390, height: 620 });
  const search = dialog.getByRole('searchbox');
  const options = dialog.locator('.layer-options');
  const searchBefore = await search.boundingBox();
  await options.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const searchAfter = await search.boundingBox();
  expect(searchBefore?.y).toBe(searchAfter?.y);
  await expect(dialog.locator('.dialog-body')).toHaveCSS('overflow', 'hidden');
  await expect(options).toHaveCSS('overflow-y', 'auto');
  await search.fill('bnpb');
  await expect(dialog.locator('.layer-option')).toHaveCount(1);
  await expect(dialog.locator('.layer-option')).toContainText('Disaster reports');
  await dialog.getByRole('searchbox').fill('zzz');
  await expect(dialog.getByText('No matching layers.')).toBeVisible();
});

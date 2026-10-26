import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
});

test('Destinations displays both landmark categories across all 38 provinces and opens gallery from a 2D marker', async ({ page }) => {
  await page.goto('/');
  await page.locator('.layer-pills button').filter({ hasText: 'Destinations' }).click();
  await expect(page.locator('.destination-explorer')).toBeVisible();
  await expect(page.locator('.province-picker button')).toHaveCount(38);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('.overlay-pin')).toHaveCount(76);
  const westJavaPin = page.locator('.overlay-pin[data-code="32"]').first();
  await westJavaPin.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/region=32/);
  await expect(page.locator('.destination-heading h3')).toHaveText('Jawa Barat');
  await expect(page.locator('.destination-card')).toHaveCount(2);
  await expect(page.locator('.destination-grid')).toContainText('Kawah Putih');
  await expect(page.locator('.destination-grid')).toContainText('Gedung Sate');

  await page.getByRole('button', { name: 'Natural', exact: true }).click();
  await expect(page.locator('.destination-card')).toHaveCount(1);
  await expect(page.locator('.destination-grid')).toContainText('Kawah Putih');
  await page.getByRole('button', { name: 'Human-made', exact: true }).click();
  await expect(page.locator('.destination-grid')).toContainText('Gedung Sate');
});

test('destination gallery falls back to a placeholder when Commons returns no photo', async ({ page }) => {
  await page.route('**/w/api.php?**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"query":{"pages":{}}}'
  }));
  await page.goto('/');
  await page.locator('.layer-pills button').filter({ hasText: 'Destinations' }).click();
  await page.locator('.province-picker button').filter({ hasText: 'Bali' }).click();
  await expect(page.locator('.destination-card')).toHaveCount(2);
  await page.locator('.destination-card').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.destination-placeholder').first()).toContainText('No photo available');
});

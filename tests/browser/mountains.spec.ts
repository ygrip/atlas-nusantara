import { expect, test } from '@playwright/test';

test('mountain directory and keyboard pins open details without replacing disaster layers', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.route('**/w/api.php?**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"query":{"pages":{}}}'
  }));
  await page.goto('/');
  await page.locator('.layer-pills button').filter({ hasText: 'Mountains' }).click();
  await expect(page.locator('.mountain-list button').first()).toBeVisible();
  await page.locator('.mountain-list button').first().click();
  await expect(page.locator('.mountain-detail')).toBeVisible();
  await expect(page.locator('.mountain-detail')).toContainText('not a live safety alert');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const pin = page.locator('.overlay-pin').first();
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mountain-detail')).toBeVisible();
  await page.locator('.layer-pills button').filter({ hasText: 'Disaster reports' }).click();
  await expect(page.locator('.mountain-detail')).toHaveCount(0);
  await expect(page.locator('.layer-pills button').filter({ hasText: 'Weather hazards' })).toBeVisible();
});

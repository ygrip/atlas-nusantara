import { expect, test } from '@playwright/test';
import { chooseLayer } from './layers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en')); });

test('local languages layer: heat map by province and a language list for the selected province', async ({ page }) => {
  await page.goto('/');
  await chooseLayer(page, 'Local languages');
  await expect(page).toHaveURL(/layer=language/);
  const panel = page.getByRole('region', { name: 'Local languages' });
  await expect(panel.locator('.summary')).toContainText('718');
  await expect(panel.locator('.top-list li')).toHaveCount(5);

  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('.heat-legend li')).toHaveCount(5);
  await expect(page.locator('svg path[data-code="32"]')).toHaveAttribute('style', /--fill-light: #[0-9a-f]{6}/i);
  await page.locator('svg path[data-code="32"]').click();
  await expect(panel.getByRole('heading', { level: 3, name: /Jawa Barat/ })).toBeVisible();
  await expect(panel.locator('.summary')).toContainText('#');
  await expect(panel.locator('.language-list li')).toHaveCount(2);
});

test('population pyramid follows the selected province and city', async ({ page }) => {
  await page.goto('/?layer=population&region=32');
  const panel = page.getByRole('region', { name: 'Population estimates' });
  await panel.getByRole('tab', { name: 'Age pyramid' }).click();
  await expect(panel.getByRole('heading', { level: 4, name: /Jawa Barat/ })).toBeVisible();
  await expect(panel.locator('.pyramid li')).toHaveCount(16);
  await expect(panel.locator('[role="note"]').last()).toContainText('2026');

  await page.goto('/?layer=population&region=35.77');
  const cityPanel = page.getByRole('region', { name: 'Population estimates' });
  await cityPanel.getByRole('tab', { name: 'Age pyramid' }).click();
  await expect(cityPanel.getByRole('heading', { level: 4, name: /Madiun/ })).toBeVisible();
});

test('every destination row can be shared with its own name and location', async ({ page }) => {
  await page.goto('/?layer=destinations&region=35');
  const firstRow = page.locator('.destination-table tbody tr').first();
  await expect(firstRow).toBeVisible();
  const name = (await firstRow.locator('th').first().innerText()).split('\n')[0].trim();
  await firstRow.getByRole('button', { name: new RegExp('^Share ') }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this place' });
  // The card waits up to eight seconds for the photo before it falls back to the province outline.
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.locator('img')).toBeVisible();
  await expect(dialog).toContainText(name);
  await expect(dialog).toContainText('Jawa Timur');
});

test('a place card shows the clock of the place, not of the browser', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nusantara:pins:v1', JSON.stringify([
    { id: 'region:91', type: 'region', code: '91', name: 'Papua', addedAt: '2026-10-28T00:00:00Z' }
  ])));
  await page.goto('/');
  const card = page.locator('.weather-place').filter({ hasText: 'Papua' });
  await expect(card.locator('.clock-chip abbr')).toHaveText('WIT');
});

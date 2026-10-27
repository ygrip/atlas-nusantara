import { expect, test } from '@playwright/test';
import { chooseLayer } from './layers';

test('population layer: national trend and pyramid tabs, province filter, heat legend, no observatory', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.goto('/');
  await chooseLayer(page, 'Population estimates');
  await expect(page).toHaveURL(/layer=population/);

  const panel = page.getByRole('region', { name: 'Population estimates' });
  await expect(panel.getByRole('button', { name: '2026' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.summary')).toContainText('287,198.4');

  // Trend tab: axes, values, area fill and a five-row table.
  await expect(panel.getByRole('tab', { name: 'Trend' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('svg.history .grid').first()).toBeAttached();
  await expect(panel.locator('svg.history path[fill^="url"]')).toHaveCount(1);
  await expect(panel.locator('svg.history .point-value')).toHaveCount(5);
  await expect(panel.locator('.history-table tbody tr')).toHaveCount(5);

  // Pyramid tab.
  await panel.getByRole('tab', { name: 'Age pyramid' }).click();
  await expect(panel.locator('.pyramid li')).toHaveCount(16);

  // Year change updates the summary.
  await panel.getByRole('button', { name: '2024' }).click();
  await expect(panel.locator('.summary')).toContainText('281,603.8');

  // Observatory has no data for this layer, so the section and its nav link are gone.
  await expect(page.locator('#summary')).toHaveCount(0);
  await expect(page.locator('.section-nav a[href="#summary"]')).toHaveCount(0);

  // Heat legend lists five classes.
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await expect(page.locator('svg path[data-code="32"]')).toHaveAttribute('style', /--fill-light: #[0-9a-f]{6}/i);
  await expect(page.locator('.heat-legend li')).toHaveCount(5);

  // Selecting a province filters the panel to that province.
  await page.locator('svg path[data-code="32"]').click();
  await expect(panel.getByRole('heading', { name: /Jawa Barat/ })).toBeVisible();
  await expect(panel.locator('.summary.five')).toBeVisible();
  await expect(panel.locator('.history-table tbody tr')).toHaveCount(5);
});

test('a province created in 2024 shows only comparable years', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.goto('/?layer=population&region=93');
  const panel = page.getByRole('region', { name: 'Population estimates' });
  await expect(panel.getByRole('heading', { level: 3, name: /Papua Selatan/ })).toBeVisible();
  await expect(panel.locator('.history-table tbody tr')).toHaveCount(3);
  await expect(panel.getByRole('button', { name: '2023' })).toBeDisabled();
  await expect(panel.locator('[role="note"]').first()).toContainText('before 2024');
});

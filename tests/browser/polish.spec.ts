import { expect, test } from '@playwright/test';
import { openProvinceDetails } from './layers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('PARAGLIDE_LOCALE')) localStorage.setItem('PARAGLIDE_LOCALE', 'en');
  });
});

test('language search filters English names, native names and codes, with keyboard selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose your language' });
  const search = dialog.getByRole('searchbox');
  await expect(search).toBeFocused();
  for (const query of ['Vietnamese', 'tieng viet', 'vi']) {
    await search.fill(query);
    await expect(dialog.locator('.language-grid button[lang="vi"]')).toBeVisible();
  }
  await search.fill('not-a-language');
  await expect(dialog.locator('.language-grid button')).toHaveCount(0);
  await expect(dialog.getByRole('status')).toBeVisible();
  await search.fill('Indonesian');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
  await expect(search).toHaveValue('');
  await search.fill('Indonesian');
  await page.keyboard.press('ArrowDown');
  await expect(dialog.locator('button[lang="id"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
});

for (const [theme, width] of [['dark', 390], ['light', 1440]] as const) {
  {
    test(`homepage sections remain readable at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(theme => localStorage.setItem('nusantara:theme', theme), theme);
      await page.goto('/?region=32');
      await expect(page.locator('.island-chart .bars li')).toHaveCount(7);
      await expect(page.locator('.island-chart h3')).toHaveCount(1);
      const hiddenTable = page.locator('.island-chart .visually-hidden');
      await expect(hiddenTable).toHaveCSS('clip-path', 'inset(50%)');
      const summary = page.locator('#summary');
      expect(parseFloat(await summary.evaluate(el => getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(18);
      await expect(page.locator('.hero-copy')).not.toContainText('Not an emergency alert service');
      expect(await page.locator('.anatomy-stage .ornament-volcano img').evaluate(el => el.getAnimations().length)).toBe(0);
      await openProvinceDetails(page);
      const active = page.locator('#provinces tr.active-region');
      await expect(active).toHaveCount(1);
      await expect(active.locator('.selected-marker')).toBeVisible();
      await expect(active.locator('.province-link')).toHaveAttribute('aria-current', 'location');
      await expect(page.locator('.support-options a')).toHaveCount(3);
      await expect(page.locator('.support-maker')).toHaveAttribute('href', 'https://readynaz.com');
      await expect(page.locator('.footer-maker')).toHaveAttribute('href', 'https://readynaz.com');
      await expect(page.locator('.footer-col')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
}

test('region directory uses table rows and keeps selection while filtering', async ({ page }) => {
  await page.goto('/?region=35');
  const table = page.locator('.region-table');
  await expect(table.locator('tbody tr')).toHaveCount(38);
  await page.locator('#region-search').fill('Ponorogo');
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await table.getByRole('button', { name: 'Kabupaten Ponorogo 35.02', exact: true }).click();
  await expect(page).toHaveURL(/region=35\.02/);
  await expect(table.locator('tr.selected')).toContainText('Kabupaten Ponorogo');
  await expect(table.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
});

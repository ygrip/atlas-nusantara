import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('PARAGLIDE_LOCALE')) localStorage.setItem('PARAGLIDE_LOCALE', 'en'); });
});

test('desktop language popup lists 13 flagged languages and changes the locale', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose your language', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose your language' });
  await expect(dialog.locator('.language-grid button')).toHaveCount(13);
  await expect(dialog.locator('.flag')).toHaveCount(13);
  await dialog.locator('button[lang="id"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('PARAGLIDE_LOCALE'))).toBe('id');
});

test('mobile settings groups language, share and theme, with reversible theme transitions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.masthead .brand-mobile')).toHaveText('Nusantara');
  const settings = page.getByRole('button', { name: 'Quick settings' });
  // A native details summary exposes the button role.
  await settings.click();
  const menu = page.locator('.quick-menu');
  await expect(menu.getByRole('button')).toHaveCount(3);
  await menu.getByRole('button', { name: 'Switch color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await menu.getByRole('button', { name: 'Switch color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await menu.getByRole('button', { name: /Language/ }).click();
  await expect(page.getByRole('dialog', { name: 'Choose your language' })).toBeVisible();
  await page.keyboard.press('Escape');
  await settings.click();
  await menu.getByRole('button', { name: 'Share this atlas', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Share this atlas' })).toBeVisible();
});

test('a city picked from the table updates the map, breadcrumb and highlighted province', async ({ page }) => {
  await page.goto('/');
  await page.locator('#provinces').getByRole('button', { name: 'Details · Jawa Barat' }).click();
  const dialog = page.getByRole('dialog', { name: 'Jawa Barat' });
  await dialog.getByRole('button', { name: 'Kota Bandung 32.73', exact: true }).click();
  await expect(page).toHaveURL(/region=32\.73/);
  await expect(page.locator('.atlas-breadcrumb')).toContainText('Kota Bandung');
  await expect(page.locator('#provinces tr.active-region')).toContainText('Jawa Barat');
  await expect(page.locator('#roadmap, #sources, .edition-card')).toHaveCount(0);
});

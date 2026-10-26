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
  // The mobile trigger owns aria-expanded while the gooey options are open.
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
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


test('mobile hero and header do not overflow or show a preview-share CTA', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Preview share card' })).toHaveCount(0);
  await expect(page.locator('.hero-actions .clay-button')).toHaveCount(2);
  const layout = await page.evaluate(() => {
    const header = document.querySelector('.masthead')!.getBoundingClientRect();
    const nav = document.querySelector('.section-nav')!.getBoundingClientRect();
    const controls = document.querySelector('.header-actions')!.getBoundingClientRect();
    return { headerHeight: header.height, navMid: nav.top + nav.height / 2, controlMid: controls.top + controls.height / 2, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(layout.headerHeight).toBeLessThan(74);
  expect(Math.abs(layout.navMid - layout.controlMid)).toBeLessThan(8);
  expect(layout.overflow).toBeLessThanOrEqual(1);
});

test('mobile gooey settings close with Escape and dismiss via backdrop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Quick settings' });
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await settings.click();
  await page.locator('.menu-scrim button').click({ position: { x: 5, y: 300 } });
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
});

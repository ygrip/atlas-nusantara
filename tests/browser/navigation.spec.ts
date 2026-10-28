import { expect, test } from './fixtures';
import { openProvinceDetails } from './layers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('PARAGLIDE_LOCALE')) localStorage.setItem('PARAGLIDE_LOCALE', 'en'); });
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
  for (const button of await menu.getByRole('button').all()) {
    await expect(button).toHaveText('');
    await expect.poll(async () => {
      const bounds = await button.boundingBox();
      return [Math.round(bounds?.width ?? 0), Math.round(bounds?.height ?? 0)];
    }).toEqual([48, 48]);
    await expect(button).toHaveCSS('border-radius', '50%');
  }
  await menu.getByRole('button', { name: 'Switch color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await menu.getByRole('button', { name: 'Switch color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await menu.getByRole('button', { name: 'Choose your language', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose your language' })).toBeVisible();
  await page.keyboard.press('Escape');
  await settings.click();
  await menu.getByRole('button', { name: 'Share this atlas', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Share this atlas' })).toBeVisible();
});

test('a city picked from the table updates the map, breadcrumb and highlighted province', async ({ page }) => {
  await page.goto('/');
  await openProvinceDetails(page);
  await page.locator('#provinces .province-table').getByRole('button', { name: 'Details · Jawa Barat' }).click();
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
  await expect(page.locator('.section-nav')).toBeHidden();
  await expect(page.locator('.masthead button:visible')).toHaveCount(1);
  const layout = await page.evaluate(() => {
    const header = document.querySelector('.masthead')!.getBoundingClientRect();
    const controls = document.querySelector('.header-actions')!.getBoundingClientRect();
    return { headerHeight: header.height, rightGap: header.right - controls.right, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(layout.headerHeight).toBeLessThan(74);
  expect(layout.rightGap).toBeLessThan(14);
  expect(layout.overflow).toBeLessThanOrEqual(1);
});

for (const theme of ['dark']) {
  test(`mobile metric cards retain desktop colors and decoration in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(theme => localStorage.setItem('nusantara:theme', theme), theme);
    await page.goto('/');
    const cards = page.locator('.stat-card');
    await expect(cards).toHaveCount(3);
    // The numbers count up when they scroll into view; compare them once every count has settled.
    await cards.first().scrollIntoViewIfNeeded();
    await expect(page.locator('.animated-number[data-settled="true"]')).toHaveCount(3, { timeout: 8000 });
    const appearance = () => cards.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundImage, color: style.color, decoration: getComputedStyle(element, '::after').display, value: element.querySelector('strong')?.textContent };
    }));
    const desktop = await appearance();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await appearance()).toEqual(desktop);
    expect(desktop.every(card => card.background.includes('linear-gradient') && card.decoration !== 'none')).toBe(true);
  });
}

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

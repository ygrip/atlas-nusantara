import { expect, test } from '@playwright/test';
import { choosePlace } from './layers';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en')); });

test('place picker is a searchable popup with keyboard selection', async ({ page }) => {
  await page.goto('/');
  await page.locator('.place-trigger').click();
  const dialog = page.getByRole('dialog', { name: 'Choose a place' });
  const search = dialog.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('bandung');
  await expect(dialog.getByRole('option').first()).toContainText('Bandung');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.place-trigger')).toContainText('Bandung');
  await page.locator('.place-trigger').click();
  await dialog.getByRole('combobox').fill('zzzzzz');
  await expect(dialog.getByRole('status')).toContainText('No matching regions');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await choosePlace(page, 'Bali');
  await expect(page.locator('.place-trigger')).toContainText('Bali');
});

test('weather warnings show severity, areas, expiry and filter by severity', async ({ page }) => {
  await page.route('**/data/observations/hazards.json', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString();
    const later = new Date(Date.now() + 30 * 3600_000).toISOString();
    for (const [index, warning] of data.warnings.items.entries()) {
      warning.expires = index === 0 ? soon : later;
      warning.effective = new Date(Date.now() - 3600_000).toISOString();
      warning.severity = index === 0 ? 'Severe' : 'Moderate';
    }
    await route.fulfill({ response, json: data });
  });
  await page.goto('/?layer=hazard');
  const cards = page.locator('.warning-card');
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().locator('.severity-pill')).toContainText('Severe');
  await expect(cards.first().locator('.ends-in')).toContainText('3 hours');
  await expect(cards.first().locator('.area-chips li').first()).toBeVisible();
  const total = await cards.count();
  await page.getByRole('group', { name: 'Filter by severity' }).getByRole('button', { name: /^Severe/ }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole('group', { name: 'Filter by severity' }).getByRole('button', { name: /^All/ }).click();
  await expect(cards).toHaveCount(total);
});

test('the empty observatory falls back to the saved snapshots', async ({ page }) => {
  await page.goto('/');
  const saved = page.getByTestId('saved-observatory');
  await expect(saved).toBeVisible();
  // Only the selected layer's saved figure is shown (weather forecast points on the default layer).
  await expect(saved.locator('.summary-counts article')).toHaveCount(1);
  await expect(saved).toContainText('saved snapshots');
});

test('map key and weather readout collapse into an info button and expand again', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const key = page.getByRole('button', { name: /Map key/ });
  await expect(key).toHaveAttribute('aria-expanded', 'true');
  await key.click();
  await expect(key).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.map-legend .content')).toHaveAttribute('inert', '');
  await key.click();
  await expect(key).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.map-legend .content')).toBeVisible();
  await page.locator('.region-table').getByRole('button', { name: /^Bali/ }).first().click();
  const readout = page.locator('.weather-readout');
  await expect(readout).toContainText('Temperature');
  const toggle = readout.getByRole('button');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('scrollable tables get the dedicated scrollbar and stay keyboard reachable', async ({ page }) => {
  await page.goto('/');
  const scroller = page.locator('.region-table-scroll');
  await expect(scroller).toHaveClass(/scroll-area/);
  await scroller.focus();
  await expect(scroller).toBeFocused();
  const before = await scroller.evaluate(element => element.scrollTop);
  await page.keyboard.press('PageDown');
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
});

test('hero image fills its frame', async ({ page }) => {
  await page.goto('/');
  const fit = await page.locator('.hero-art img').evaluate(image => getComputedStyle(image).objectFit);
  expect(fit).toBe('cover');
});

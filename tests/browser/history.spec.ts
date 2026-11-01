import { test, expect } from './fixtures';

test('historical timeline loads lazily, scrubs major eras and exposes sourced downloads @smoke', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Nusantara through time');
  await expect(panel).toContainText('Sriwijaya');
  const slider = panel.getByRole('slider', { name: 'Historical year' });
  await expect(slider).toHaveValue('682');
  await slider.evaluate((element: HTMLInputElement) => {
    element.value = '1350';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(slider).toHaveValue('1350');
  await expect(panel).toContainText('Majapahit');
  await panel.getByRole('button', { name: /export/i }).click();
  const exportDialog = page.getByRole('dialog');
  await expect(exportDialog.getByRole('button', { name: /^JSON/ })).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: /^CSV/ })).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: /^XML/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.atlas-map .history-territories')).toHaveAttribute('clip-path', /history-land-/);
  const majapahit = page.locator('.atlas-map .history-territory[data-history-id="majapahit"]');
  await expect(majapahit).toBeVisible();
  await majapahit.focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('.polity-detail h4')).toHaveText('Majapahit');
  await expect(page.locator('.history-map-detail')).toContainText('Majapahit');
  await expect(page.locator('.atlas-map .history-label').first()).toBeVisible();
  await expect(page.locator('.atlas-map .history-label.focused')).toHaveCount(1);
  const mapLabel = page.locator('.atlas-map .history-label').first();
  await mapLabel.click();
  await expect(panel.locator('.polity-detail h4')).toContainText(await mapLabel.textContent() ?? '');
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeDisabled();
});

test('history stays usable on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  await expect(panel).toBeVisible();
  await expect(page.locator('.history-territory[data-history-id="srivijaya"]')).toBeVisible();
  await expect(panel.locator('.polity-detail')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

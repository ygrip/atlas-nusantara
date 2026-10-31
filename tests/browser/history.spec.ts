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
  await expect(panel.getByRole('button', { name: 'Download JSON' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Download CSV' })).toBeVisible();
  await expect(page.locator('.atlas-map .history-heat circle').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeDisabled();
});

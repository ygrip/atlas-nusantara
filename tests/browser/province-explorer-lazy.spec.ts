import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

test('province table loads on first tab activation and retains its filter and selected row', async ({ page }) => {
  await page.goto('/?region=11');
  const section = page.locator('#provinces');
  const overviewTab = section.getByRole('tab', { name: 'Overview' });
  const provincesTab = section.getByRole('tab', { name: 'Province details' });
  const panel = section.locator('#province-explorer-panel-provinces');
  await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.province-table')).toHaveCount(0);

  await provincesTab.click();
  await expect(provincesTab).toHaveAttribute('aria-selected', 'true');
  await expect(panel.locator('.province-table tbody tr')).toHaveCount(38);
  await expect(panel.locator('tr.active-region')).toContainText('11');

  await panel.getByRole('group', { name: 'Island group' }).getByRole('button', { name: 'Sumatra' }).click();
  await expect(panel.locator('.province-table tbody tr')).toHaveCount(10);
  await expect(panel.locator('tr.active-region')).toContainText('11');

  await overviewTab.click();
  await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
  await provincesTab.click();
  await expect(panel.locator('.province-table tbody tr')).toHaveCount(10);
  await expect(panel.getByRole('group', { name: 'Island group' }).getByRole('button', { name: 'Sumatra' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('tr.active-region')).toContainText('11');
});

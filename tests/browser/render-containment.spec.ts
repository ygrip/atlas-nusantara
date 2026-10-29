import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'block' });

test('SSR tabs wait for hydration while native navigation remains available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#province-explorer-tab-provinces')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Browse provinces', exact: true })).toHaveAttribute('href', '#provinces');
  } finally {
    await context.close();
  }
});

for (const width of [390, 1440]) {
  test(`render containment preserves anchors, dialogs and map activation at ${width}px`, async ({ page, browserName }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    let visibility = 'auto';
    if (browserName === 'webkit') visibility = 'visible';
    await expect(page.locator('.province-explorer')).toHaveCSS('content-visibility', visibility);

    await page.getByRole('link', { name: 'Browse provinces', exact: true }).click();
    await expect(page).toHaveURL(/#provinces$/);
    await expect(page.locator('#province-explorer-heading')).toBeInViewport();
    await page.locator('#province-explorer-tab-provinces').click();
    await expect(page.locator('.province-table tbody tr')).toHaveCount(38);
    await page.getByRole('button', { name: 'Details · Jawa Barat', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Jawa Barat' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    if (!bounds) throw Error('Contained dialog has no layout');
    expect(bounds.x >= 0 && bounds.x + bounds.width <= width).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.locator('#locations').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Use device location' })).toBeInViewport();
    await page.getByRole('link', { name: 'Explore the map', exact: true }).click();
    await expect(page).toHaveURL(/#atlas$/);
    if (browserName === 'webkit') {
      await page.getByRole('button', { name: '2D', exact: true }).click();
      await expect(page.locator('.pane-2d svg path[data-code]')).toHaveCount(38);
      return;
    }
    const map = page.locator('.atlas-3d');
    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    const canvas = page.locator('canvas.atlas-canvas');
    await expect(canvas).toBeVisible();
    const size = await canvas.boundingBox();
    if (!size) throw Error('Contained map has no layout');
    expect(size.width > 0 && size.height > 0).toBe(true);
  });
}

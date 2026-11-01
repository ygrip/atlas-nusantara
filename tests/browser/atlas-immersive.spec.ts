import { expect, test, type Page } from './fixtures';

const viewports = [
  { name: 'desktop', width: 1280, height: 800, isMobile: false },
  { name: 'phone', width: 390, height: 844, isMobile: true }
];

async function openAtlas(page: Page) {
  await page.goto('/');
  await expect(page.locator('#atlas-stage .clay-map')).toBeVisible();
  await page.locator('#atlas .section-heading').scrollIntoViewIfNeeded();
}

for (const viewport of viewports) {
  test.describe('full-screen atlas on ' + viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.isMobile, reducedMotion: 'reduce', serviceWorkers: 'block' });

    test('the map fills the screen and the page behind is locked and hidden from keyboard users', async ({ page }) => {
      await openAtlas(page);
      await page.getByRole('button', { name: 'Full screen' }).click();

      const exit = page.getByRole('button', { name: 'Exit full screen' });
      await expect(exit).toBeVisible();
      await expect(exit).toBeFocused();
      await expect(page.locator('html')).toHaveClass(/atlas-immersive/);
      await expect(page.locator('.masthead')).toHaveAttribute('inert', '');
      await expect(page.locator('#provinces')).toHaveAttribute('inert', '');

      const map = await page.locator('.atlas-view').boundingBox();
      if (!map) throw Error('The map area is missing.');
      expect(map.width).toBeGreaterThanOrEqual(viewport.width * 0.5);
      expect(map.height).toBeGreaterThanOrEqual(viewport.height * 0.7);
      await expect(page.locator('.clay-map .map-toolbar')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
      await expect(page.locator('.atlas-breadcrumb')).toBeVisible();
      await expect(page.locator('.atlas-actions')).toBeVisible();
      await expect(page.locator('.atlas-brand-logo')).toBeVisible();
      await expect(page.locator('.layer-picker-trigger')).toBeVisible();
    });

    test('Esc, the exit button and the Back button each leave full screen', async ({ page }) => {
      await openAtlas(page);
      const enter = page.getByRole('button', { name: 'Full screen' });
      const scrollBefore = await page.evaluate(() => scrollY);

      await enter.click();
      await page.keyboard.press('Escape');
      await expect(page.locator('html')).not.toHaveClass(/atlas-immersive/);

      await enter.click();
      await page.getByRole('button', { name: 'Exit full screen' }).click();
      await expect(page.locator('html')).not.toHaveClass(/atlas-immersive/);

      await enter.click();
      await page.goBack();
      await expect(page.locator('html')).not.toHaveClass(/atlas-immersive/);
      await expect(page.locator('.masthead')).not.toHaveAttribute('inert', '');
      expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
    });

    test('the details panel keeps the directory reachable and toggles', async ({ page }) => {
      await openAtlas(page);
      await page.getByRole('button', { name: 'Full screen' }).click();
      const stage = page.locator('#atlas-stage');
      const toggle = page.getByRole('button', { name: 'Details' });
      await expect(toggle).toBeVisible();

      if (viewport.isMobile) await toggle.click();
      await expect(stage).toHaveClass(/drawer-open/);
      await expect(stage.getByRole('searchbox', { name: 'Search region or code' })).toBeVisible();

      await toggle.click();
      await expect(stage).not.toHaveClass(/drawer-open/);
      await expect(stage.getByRole('searchbox', { name: 'Search region or code' })).toBeHidden();
    });

    test('closing the layer picker with Esc keeps the atlas full screen', async ({ page }) => {
      await openAtlas(page);
      await page.getByRole('button', { name: 'Full screen' }).click();
      await page.locator('.layer-picker-trigger').click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(page.locator('html')).toHaveClass(/atlas-immersive/);
    });
  });
}

test('opening and closing full screen leaves the page where it was', async ({ page }) => {
  await openAtlas(page);
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(page.locator('html')).toHaveClass(/atlas-immersive/);
  expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/atlas-immersive/);
  expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThanOrEqual(2);
});

test.describe('full-screen atlas motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });

  test('enter and exit animate the shell, then leave a clean page', async ({ page }) => {
    await openAtlas(page);
    await page.evaluate(() => {
      const original = Element.prototype.animate;
      (window as unknown as { __shellAnimations: number }).__shellAnimations = 0;
      Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
        if (this.classList.contains('atlas-shell')) (window as unknown as { __shellAnimations: number }).__shellAnimations++;
        return original.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Full screen' }).click();
    await expect(page.locator('html')).toHaveClass(/atlas-immersive/);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shellAnimations: number }).__shellAnimations)).toBe(1);

    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shellAnimations: number }).__shellAnimations)).toBe(2);
    await expect(page.locator('html')).not.toHaveClass(/atlas-immersive/);
    await expect(page.locator('#atlas')).not.toHaveClass(/immersive/);
    await expect(page.locator('.masthead')).not.toHaveAttribute('inert', '');
  });

  test('reopening while the exit is still playing ends in full screen', async ({ page }) => {
    await openAtlas(page);
    const enter = page.getByRole('button', { name: 'Full screen' });
    await enter.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    await enter.click();
    await page.waitForTimeout(700);
    await expect(page.locator('#atlas')).toHaveClass(/immersive/);
    await expect(page.locator('html')).toHaveClass(/atlas-immersive/);
  });
});

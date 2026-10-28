import { expect, test, type Locator, type Page } from './fixtures';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });

async function zoomLevel(page: Page): Promise<number> {
  return Number.parseFloat(await page.locator('.clay-map .map-controls output').innerText());
}

async function pinch(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  if (!bounds) throw Error('Map viewport is missing.');
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const session = await page.context().newCDPSession(page);
  const points = (distance: number) => [
    { id: 1, x: center.x - distance, y: center.y, radiusX: 3, radiusY: 3, force: 1 },
    { id: 2, x: center.x + distance, y: center.y, radiusX: 3, radiusY: 3, force: 1 }
  ];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(40) });
  for (const distance of [46, 54, 64, 76]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
    await page.waitForTimeout(25);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

async function doubleTap(page: Page, target: Locator) {
  const bounds = await target.boundingBox();
  if (!bounds) throw Error('Map viewport is missing.');
  const session = await page.context().newCDPSession(page);
  const point = { id: 1, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, radiusX: 3, radiusY: 3, force: 1 };
  for (const count of [0, 1]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (count === 0) await page.waitForTimeout(40);
  }
  await session.detach();
}

async function expectFilledViewport(target: Locator, graphic: Locator) {
  const outer = await target.boundingBox();
  const inner = await graphic.boundingBox();
  if (!outer || !inner) throw Error('Map bounds are unavailable.');
  expect(Math.abs(outer.width - inner.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(outer.height - inner.height)).toBeLessThanOrEqual(2);
}

test('mobile 2D SVG fills its viewport before and after pinch and resize', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'This touch integration check uses Chromium CDP.');
  await page.goto('/');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const viewport = page.locator('.pane-2d .atlas-map');
  const svg = viewport.locator('svg');
  await expect(svg.locator('path[data-code]')).toHaveCount(38);
  await expectFilledViewport(viewport, svg);
  const before = await zoomLevel(page);
  await pinch(page, viewport);
  await expect.poll(() => zoomLevel(page)).toBeGreaterThan(before * 1.4);
  await expect(page).not.toHaveURL(/region=/);
  await expectFilledViewport(viewport, svg);
  await page.setViewportSize({ width: 320, height: 740 });
  await expectFilledViewport(viewport, svg);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await viewport.screenshot({ path: 'test-results/mobile-2d-map.png' });
});

test('switching map mode cancels rapid pending touch selections', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'This touch integration check uses Chromium CDP.');
  await page.goto('/');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const viewport = page.locator('.pane-2d .atlas-map');
  await viewport.scrollIntoViewIfNeeded();
  const points = [];
  for (const code of ['32', '64']) {
    const point = await viewport.locator(`path[data-code="${code}"]`).evaluate(element => {
      const path = element as SVGPathElement;
      const box = path.getBBox();
      for (const portion of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        for (const row of [0.5, 0.3, 0.7, 0.15, 0.85]) {
          const local = new DOMPoint(box.x + box.width * portion, box.y + box.height * row);
          if (!path.isPointInFill(local)) continue;
          const matrix = path.getScreenCTM();
          if (!matrix) throw Error('Map transform is unavailable.');
          const screen = local.matrixTransform(matrix);
          return { x: screen.x, y: screen.y };
        }
      }
      throw Error('No visible interior point found.');
    });
    points.push(point);
  }
  const session = await page.context().newCDPSession(page);
  for (const point of points) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, ...point, radiusX: 2, radiusY: 2, force: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.getByRole('button', { name: '3D', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await page.waitForTimeout(400);
  await expect(page).not.toHaveURL(/region=/);
  await session.detach();
});

test('mobile 3D canvas fills its viewport and real touch pinch zooms without selecting a region', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'This touch integration check uses Chromium CDP.');
  await page.goto('/');
  const viewport = page.locator('.atlas-3d');
  await viewport.scrollIntoViewIfNeeded();
  await expect(viewport).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  const canvas = viewport.locator('canvas');
  await expectFilledViewport(viewport, canvas);
  const before = await zoomLevel(page);
  await pinch(page, canvas);
  await expect.poll(() => zoomLevel(page)).toBeGreaterThan(before * 1.4);
  await expect(page).not.toHaveURL(/region=/);
  await expectFilledViewport(viewport, canvas);
  await viewport.screenshot({ path: 'test-results/mobile-3d-map.png' });
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await page.locator('.clay-map .tool.reset').click();
  await expect.poll(() => zoomLevel(page)).toBe(1);
  await canvas.scrollIntoViewIfNeeded();
  await doubleTap(page, canvas);
  await expect.poll(() => zoomLevel(page)).toBeGreaterThan(1.4);
  await expect(page).not.toHaveURL(/region=/);
});

for (const colorScheme of ['light', 'dark'] as const) {
 test(`mobile install card, menu and share dialog use glossy clay controls in ${colorScheme} mode`, async ({ page }) => {
  await page.emulateMedia({ colorScheme });
  await page.goto('/');
  const installCard = page.locator('.pwa-panel');
  await expect(installCard).toBeVisible();
  const installStyle = await installCard.evaluate(element => ({ background: getComputedStyle(element).backgroundImage, shadow: getComputedStyle(element).boxShadow }));
  expect(installStyle.background).toContain('gradient');
  expect(installStyle.shadow).toContain('inset');
  await page.locator('.pwa-install').click();
  await expect(installCard.locator('.pwa-guide')).toBeVisible();
  await installCard.screenshot({ path: `test-results/mobile-install-card-${colorScheme}.png` });
  const trigger = page.locator('.quick-trigger');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.quick-menu').getByRole('button', { name: /Share/ }).click();
  const dialog = page.locator('.share-panel dialog[open]');
  await expect(dialog).toBeVisible();
  const button = dialog.locator('.share-actions button').first();
  expect(await button.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('gradient');
  const bounds = await button.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await dialog.screenshot({ path: `test-results/mobile-share-dialog-${colorScheme}.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
 });
}

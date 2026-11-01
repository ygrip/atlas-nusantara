import { test, expect } from './fixtures';

test('historical timeline loads lazily, scrubs major eras and exposes sourced downloads @smoke', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Nusantara through time');
  await expect(panel).toContainText('Sriwijaya');
  const historyMap = page.locator('.atlas-map.historical');
  await expect(historyMap.locator('path[data-code]').first()).toHaveCSS('fill', 'rgb(240, 236, 230)');
  await expect(historyMap.locator('path[data-code][role="button"]')).toHaveCount(0);
  await expect(historyMap.locator('.history-heat')).toHaveCount(0);
  await expect(historyMap.locator('.history-label-button path').first()).toBeVisible();
  const slider = panel.getByRole('slider', { name: 'Historical year' });
  await expect(slider).toHaveValue('682');
  await expect(slider).toHaveAttribute('aria-valuetext', '682 CE');
  await slider.evaluate((element: HTMLInputElement) => { element.value = '-50'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(historyMap.getByRole('link', { name: /Buni archaeological culture/ })).toBeVisible();
  await expect(panel).toContainText('No documented polity');
  await slider.evaluate((element: HTMLInputElement) => { element.value = '375'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(panel).toContainText('Kutai Martadipura');
  await slider.evaluate((element: HTMLInputElement) => { element.value = '682'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await panel.getByRole('button', { name: 'Previous milestone' }).click();
  await expect(slider).toHaveValue('400');
  await panel.getByRole('button', { name: 'Next milestone' }).click();
  await expect(slider).toHaveValue('682');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('683');
  await slider.evaluate((element: HTMLInputElement) => {
    element.value = '1350';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(slider).toHaveValue('1350');
  await expect(panel).toContainText('Majapahit');
  const colors = await panel.locator('.polity-choices .dot').evaluateAll(dots => dots.map(dot => getComputedStyle(dot).backgroundColor));
  expect(new Set(colors).size).toBe(colors.length);
  await panel.getByRole('button', { name: /export/i }).click();
  const exportDialog = page.getByRole('dialog');
  await expect(exportDialog.getByRole('button', { name: /^GeoJSON/ })).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: /^JSON/ })).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: /^CSV/ })).toBeVisible();
  await expect(exportDialog.getByRole('button', { name: /^XML/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.atlas-map .history-territories')).not.toHaveAttribute('clip-path');
  const majapahit = page.locator('.atlas-map .history-territory[data-history-id="majapahit"]');
  await expect(majapahit).toBeVisible();
  await majapahit.scrollIntoViewIfNeeded();
  await expect.poll(() => majapahit.evaluate((path: SVGPathElement) => {
    const bounds = path.getBBox();
    const matrix = path.getScreenCTM();
    if (!matrix) return false;
    for (let row = 0; row < 20; row++) {
      for (let column = 0; column < 20; column++) {
        const point = new DOMPoint(bounds.x + bounds.width * (column + 0.5) / 20, bounds.y + bounds.height * (row + 0.5) / 20);
        if (!path.isPointInFill(point)) continue;
        const screen = point.matrixTransform(matrix);
        if (document.elementFromPoint(screen.x, screen.y) === path) return true;
      }
    }
    return false;
  })).toBe(true);
  await majapahit.focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('.polity-detail h4')).toHaveText('Majapahit');
  await expect(page.locator('.atlas-map .history-readout')).toContainText('Majapahit');
  await expect(page.locator('.atlas-map .history-label').first()).toBeVisible();
  await expect(page.locator('.atlas-map .history-label.focused')).toHaveCount(1);
  const mapLabel = page.locator('.atlas-map .history-label').first();
  await mapLabel.click();
  await expect(panel.locator('.polity-detail h4')).toContainText(await mapLabel.textContent() ?? '');
  await expect(page.getByRole('button', { name: '3D', exact: true })).toBeEnabled();
});

test('modern Indonesia stays stable across unchanged periods and expired labels leave softly', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  const slider = panel.getByRole('slider', { name: 'Historical year' });
  const setYear = async (year: number) => slider.evaluate((element: HTMLInputElement, value: number) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, year);
  await setYear(2001);
  const indonesia = page.locator('.atlas-map.historical .history-territory[data-history-id="indonesia"]');
  await expect(indonesia).toBeVisible();
  await indonesia.evaluate(element => element.setAttribute('data-stable-shape', 'yes'));
  await setYear(2002);
  await expect(indonesia).toHaveAttribute('data-stable-shape', 'yes');
  await expect(indonesia).toHaveCSS('stroke', 'rgb(185, 22, 44)');
  await expect(panel.locator('.place')).toContainText('Jakarta');
  await expect(panel.locator('.modern-status')).toContainText('Independent Timor-Leste');
  await setYear(1350);
  const oldName = page.locator('.atlas-map.historical .history-label').filter({ hasText: 'Majapahit' });
  await expect(oldName).toBeVisible();
  await setYear(1528);
  await expect(oldName).toHaveCount(0);
  await setYear(new Date().getUTCFullYear());
  await expect(page.locator('.history-labels .history-label')).toHaveCount(2);
  await expect(indonesia).toHaveCSS('opacity', '1');
  await page.locator('.atlas-map.historical').screenshot({ path: 'output/history-modern-2d.png', animations: 'disabled' });
  const borneoFill = await indonesia.evaluate(path => {
    const bounds = path.getBoundingClientRect();
    const land = document.elementFromPoint(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.35);
    return land?.getAttribute('data-history-id');
  });
  expect(borneoFill).toBe('indonesia');
});

test('history stays usable on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  await expect(panel).toBeVisible();
  await expect(page.locator('.history-territory[data-history-id="srivijaya"]')).toBeVisible();
  await expect(panel.locator('.polity-detail')).toBeVisible();
  const readout = page.locator('.atlas-map .history-readout');
  const openReadout = readout.getByRole('button', { name: 'Show Sriwijaya' });
  await expect(openReadout).toHaveAttribute('aria-expanded', 'false');
  await openReadout.click();
  await expect(readout.getByRole('button', { name: 'Hide Sriwijaya' })).toHaveAttribute('aria-expanded', 'true');
  await readout.getByRole('button', { name: 'Hide Sriwijaya' }).click();
  await expect(readout.getByRole('button', { name: 'Show Sriwijaya' })).toHaveAttribute('aria-expanded', 'false');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(page.locator('.atlas-map.historical path[data-code]').first()).toHaveCSS('fill', 'rgb(65, 70, 74)');
  const previous = panel.getByRole('button', { name: 'Previous milestone' });
  const next = panel.getByRole('button', { name: 'Next milestone' });
  await expect(previous).toHaveCSS('border-radius', '50%');
  await expect(next).toHaveCSS('border-radius', '50%');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('touching neutral land does not open a modern province in history mode', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(baseURL + '/?layer=history');
    const land = page.locator('.atlas-map.historical path[data-code="93"]');
    await land.scrollIntoViewIfNeeded();
    const point = await land.evaluate((path: SVGPathElement) => {
      const bounds = path.getBBox();
      const matrix = path.getScreenCTM();
      if (!matrix) return undefined;
      for (let row = 0; row < 20; row++) for (let column = 0; column < 20; column++) {
        const local = new DOMPoint(bounds.x + bounds.width * (column + 0.5) / 20, bounds.y + bounds.height * (row + 0.5) / 20);
        if (!path.isPointInFill(local)) continue;
        const screen = local.matrixTransform(matrix);
        if (document.elementFromPoint(screen.x, screen.y) === path) return { x: screen.x, y: screen.y };
      }
      return undefined;
    });
    if (!point) throw Error('Could not find an uncovered land point');
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(350); // The map waits 280 ms to distinguish a single tap from double-tap zoom.
    await expect(page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('.atlas-map.historical path[data-code]')).toHaveCount(38);
  } finally {
    await context.close();
  }
});

import { chromium, expect, test } from './fixtures';

test('history renders on 3D relief and stays synchronized with the timeline', async ({ browserName, baseURL }) => {
  test.setTimeout(90000);
  test.skip(browserName !== 'chromium', 'WebGL software rendering is verified with Chromium.');
  const browser = await chromium.launch({ args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /THREE|Shader|WebGLProgram/.test(message.text())) errors.push(message.text());
    });
    await page.goto(baseURL + '/?layer=history');
    const slider = page.getByRole('slider', { name: 'Historical year' });
    await expect(slider).toBeVisible({ timeout: 30000 });
    const sriwijayaColor = await page.locator('.atlas-map.historical .history-label-button[data-history-id="srivijaya"] path').getAttribute('fill');
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.locator('.atlas-3d')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    const canvas = page.locator('canvas.atlas-canvas');
    await expect(canvas).toBeVisible();
    const sriwijayaLabel = page.locator('.history-screen-labels').getByRole('button', { name: 'Sriwijaya' });
    await expect(sriwijayaLabel).toBeVisible();
    await expect(sriwijayaLabel).toHaveCSS('--marker-color', sriwijayaColor!);
    await expect(page.locator('.history-screen-labels').getByText('Sriwijaya')).toBeVisible();
    await slider.evaluate((element: HTMLInputElement) => { element.value = '-50'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('.history-screen-labels').getByRole('link', { name: /Buni archaeological culture/ })).toBeVisible();
    await slider.evaluate((element: HTMLInputElement) => { element.value = '682'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('.history-panel').getByRole('button', { name: 'Play animation', exact: true }).click();
    await expect(slider).toHaveValue('732', { timeout: 10000 });
    await page.locator('.history-panel').getByRole('button', { name: 'Pause animation', exact: true }).click();
    await expect(page.locator('.history-screen-labels').getByRole('button', { name: 'Medang (Mataram Kuno)' })).toBeVisible();
    await slider.evaluate((element: HTMLInputElement) => { element.value = '682'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    const readout = page.locator('.atlas-3d .history-readout');
    await expect(readout).toContainText('Sriwijaya');
    await expect(readout.getByRole('button', { name: 'Hide Sriwijaya' })).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.history-screen-labels').getByRole('button', { name: 'Sunda / Pajajaran' }).click();
    await expect(readout).toContainText('Sunda / Pajajaran');
    await expect(page.locator('.polity-detail h4')).toHaveText('Sunda / Pajajaran');
    await page.locator('.history-screen-labels').getByRole('button', { name: 'Sriwijaya' }).click();
    await expect(readout).toContainText('Sriwijaya');
    const before = await canvas.screenshot();
    await slider.evaluate((element: HTMLInputElement) => {
      element.value = '1350';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(slider).toHaveAttribute('aria-valuetext', '1350 CE');
    await expect(readout).toContainText('Majapahit');
    await expect.poll(async () => !(await canvas.screenshot()).equals(before), { timeout: 20000 }).toBe(true);
    await slider.evaluate((element: HTMLInputElement) => { element.value = '1945'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await slider.evaluate((element: HTMLInputElement) => { element.value = String(new Date().getUTCFullYear()); element.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('.history-screen-labels').getByRole('button', { name: 'Indonesia', exact: true })).toBeVisible();
    await expect(page.locator('.history-screen-labels').getByRole('button', { name: 'Majapahit', exact: true })).toHaveCount(0);
    await expect(readout).toContainText('present');
    // Let the two 420ms scrub blends finish before recording the visual reference.
    await page.waitForTimeout(900);
    await canvas.screenshot({ path: 'output/history-modern-3d.png' });
    await slider.evaluate((element: HTMLInputElement) => { element.value = '1350'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.history-territory[data-history-id="majapahit"]')).toBeVisible();
    await expect(page.locator('.atlas-3d')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.locator('.atlas-3d')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    const mobileReadout = page.locator('.atlas-3d .history-readout');
    await expect(mobileReadout.getByRole('button', { name: 'Show Majapahit' })).toHaveAttribute('aria-expanded', 'false');
    await mobileReadout.getByRole('button', { name: 'Show Majapahit' }).click();
    await expect(mobileReadout.getByRole('button', { name: 'Hide Majapahit' })).toHaveAttribute('aria-expanded', 'true');
    await page.locator('canvas.atlas-canvas').evaluate(canvas => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    await expect(page.locator('.clay-map')).toHaveAttribute('data-mode', '2d');
    await expect(page.getByRole('button', { name: '3D', exact: true })).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test('the 2D to 3D loading indicator is centered while history data loads', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  try {
    const page = await context.newPage();
    let requests = 0;
    await page.route('**/data/history-territories-render.geojson*', async route => {
      requests++;
      if (requests === 1) { await route.continue(); return; }
      await gate;
      await route.abort();
    });
    await page.goto(baseURL + '/?layer=history');
    await expect(page.locator('.history-territory').first()).toBeVisible();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    const stage = page.locator('.view-stage');
    const indicator = page.locator('.stage-loading .loading-card');
    await expect(indicator).toBeVisible();
    const stageBox = await stage.boundingBox();
    const indicatorBox = await indicator.boundingBox();
    expect(stageBox).not.toBeNull();
    expect(indicatorBox).not.toBeNull();
    expect(Math.abs(indicatorBox!.x + indicatorBox!.width / 2 - stageBox!.x - stageBox!.width / 2)).toBeLessThan(2);
    expect(Math.abs(indicatorBox!.y + indicatorBox!.height / 2 - stageBox!.y - stageBox!.height / 2)).toBeLessThan(2);
    release();
    await expect(page.locator('.clay-map > .map-notice')).toBeVisible();
  } finally {
    release();
    await context.close();
  }
});

test('history stays in 2D when territory data cannot be loaded', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.route('**/data/history-territories-render.geojson*', route => route.abort());
    await page.goto(baseURL + '/?layer=history');
    await expect(page.locator('.history-panel')).toBeVisible();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await expect(page.locator('.clay-map > .map-notice')).toBeVisible();
    await expect(page.locator('.clay-map')).toHaveAttribute('data-mode', '2d');
  } finally {
    await context.close();
  }
});

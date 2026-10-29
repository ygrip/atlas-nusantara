import { chromium, expect, test } from './fixtures';
import { chooseLayer } from './layers';

test('3D relief map supports wheel zoom, camera controls and snapshot-only weather', async ({ browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'WebGL software rendering is verified with Chromium; WebKit covers the SVG fallback.');
  const browser = await chromium.launch({ args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
    const errors: string[] = [];
    const providerRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /THREE|Shader|WebGLProgram/.test(message.text())) errors.push(message.text()); });
    page.on('request', request => { if (/bmkg\.go\.id/.test(request.url())) providerRequests.push(request.url()); });
    await page.goto(baseURL + '/');
    await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
    const map = page.locator('.atlas-3d');
    await expect(map).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    await map.scrollIntoViewIfNeeded();
    const zoom = page.locator('.map-controls output');
    await expect(zoom).toHaveText('1.0×');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(zoom).not.toHaveText('1.0×');
    await page.getByRole('button', { name: 'Reset map view', exact: true }).click();
    await expect(zoom).toHaveText('1.0×');
    const canvas = page.locator('canvas.atlas-canvas');
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(() => canvas.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return Math.abs(element.width / element.height - bounds.width / bounds.height) < 0.01;
    })).toBe(true);
    const bounds = await canvas.boundingBox();
    if (!bounds) throw Error('Missing 3D canvas bounds');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, -180);
    await expect(zoom).not.toHaveText('1.0×');
    await page.getByRole('button', { name: 'Tilt view', exact: true }).click();
    await page.getByRole('button', { name: 'Reset north', exact: true }).click();
    await canvas.focus();
    await page.keyboard.press('Home');
    await expect(zoom).toHaveText('1.0×');
    await expect(page.locator('.weather-bar')).toContainText('BMKG');
    const clouds = page.getByRole('button', { name: 'Clouds & rain', exact: true });
    await clouds.click();
    await expect(clouds).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.region-table').getByRole('button', { name: 'Papua Barat Daya 96', exact: true }).click();
    await expect(page.locator('.directory-count')).toContainText('6');
    await expect(page.locator('.weather-readout')).toContainText('Papua Barat Daya');
    await page.locator('.region-table').getByRole('button', { name: 'Kota Sorong 96.71', exact: true }).click();
    await expect(page.locator('.weather-readout')).toContainText('Kota Sorong');
    await page.locator('.time-slider input').evaluate(input => {
      const slider = input as HTMLInputElement;
      slider.value = String(Math.min(Number(slider.max), Number(slider.value) + 1));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('.weather-readout')).toContainText('Kota Sorong');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await expect(page.locator('.atlas-map path[data-code]')).toHaveCount(6);
    await chooseLayer(page, 'Earthquakes');
    await expect(page.locator('.epicentre')).toHaveCount(15);
    await expect(page.locator('.earthquake-panel .quake-events li')).toHaveCount(15);
    expect(errors).toEqual([]);
    expect(providerRequests).toEqual([]);
  } finally {
    await browser.close();
  }
});

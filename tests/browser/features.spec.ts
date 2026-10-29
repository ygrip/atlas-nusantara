import { expect, test, type Page } from './fixtures';
import { chooseLayer } from './layers';
// Deterministic provider/geometry fixtures must not be bypassed by a controlling service worker.
test.use({ serviceWorkers: 'block' });
const localeStorageKey = 'PARAGLIDE_LOCALE';
const pageErrors = new WeakMap<Page, string[]>();
const codeEdition = 'Kepmendagri 300.2.2-2430/2025';
function syntheticFixture(code: string, name: string) {
  return {
    schemaVersion: 1, boundaryEdition: 'SYNTHETIC TEST FIXTURE', codeEdition,
    source: 'https://example.org/synthetic-test-fixture', license: 'CC0-1.0',
    licenseUrl: 'https://example.org/synthetic-test-fixture/license', viewBox: '0 0 1000 500',
    regions: [{ id: code, sourceCode: code, name, path: 'M 100 100 L 300 100 L 300 300 L 100 300 Z', bbox: [100, 100, 300, 300] }]
  };
}

async function useEnglish(page: Page) {
  await page.addInitScript(key => localStorage.setItem(key, 'en'), localeStorageKey);
}

async function openAtlas(page: Page) {
  await useEnglish(page);
  await page.goto('/');
  await page.locator('.atlas-breadcrumb').getByRole('button', { name: 'National', exact: true }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test('persists light and dark themes and honors reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAtlas(page);
  const themeButton = page.getByRole('button', { name: 'Switch color theme' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nusantara:theme'))).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('nusantara:theme'))).toBe('light');
});

test('previews and downloads a local PNG card with a public URL that excludes device coordinates', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('nusantara:pins:v1', JSON.stringify([{ id: 'geo:-6.209,106.846', type: 'coordinates', lat: -6.209, lng: 106.846, name: '-6.209, 106.846', addedAt: new Date().toISOString() }]));
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      (window as Window & { sharedData?: { url: string; fileTypes: string[]; title: string; text: string } }).sharedData = {
        url: data.url ?? '', fileTypes: (data.files ?? []).map(file => file.type), title: data.title ?? '', text: data.text ?? ''
      };
    } });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...coordinates: number[]) {
      if (image instanceof HTMLImageElement && image.src.endsWith('/brand/logo-256.png')) {
        (window as Window & { shareLogoDrawn?: boolean }).shareLogoDrawn = true;
      }
      return Reflect.apply(drawImage, this, [image, ...coordinates]);
    };
    const original = HTMLCanvasElement.prototype.toBlob;
    const releases: Array<() => void> = [];
    const state = window as Window & { releaseShareCard?: () => void; shareCardPending?: boolean };
    state.releaseShareCard = () => {
      releases.shift()?.();
      state.shareCardPending = false;
    };
    state.shareCardPending = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (this.width < 1080 || this.height < 1080) return original.call(this, callback, type, quality);
      releases.push(() => original.call(this, callback, type, quality));
      state.shareCardPending = true;
    };
  });
  await openAtlas(page);
  await page.getByRole('button', { name: 'Share this atlas', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this atlas' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.share-loading')).toBeVisible();
  const actionButtons = dialog.locator('.share-actions button');
  await expect(actionButtons).toHaveCount(2);
  await expect(actionButtons.nth(0)).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as Window & { shareCardPending?: boolean }).shareCardPending)).toBe(true);
  await page.evaluate(() => (window as Window & { releaseShareCard?: () => void }).releaseShareCard?.());
  await expect(dialog.getByRole('img', { name: 'Nusantara public atlas share card' })).toBeVisible();
  await expect(dialog.locator('.share-loading')).toBeHidden();
  await expect(dialog.locator('.share-logo img')).toHaveAttribute('src', '/brand/logo-96.webp');
  await expect(dialog.getByRole('link', { name: 'nusantara.readynaz.com' })).toHaveAttribute('href', 'https://nusantara.readynaz.com/');
  expect(await page.evaluate(() => (window as Window & { shareLogoDrawn?: boolean }).shareLogoDrawn)).toBe(true);
  expect(await actionButtons.nth(0).evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(await actionButtons.nth(1).evaluate(element => element.getBoundingClientRect().width), 0);
  await expect(dialog.getByRole('button', { name: 'Copy public link' })).toHaveCount(0);
  const image = await dialog.getByRole('img').evaluate(async node => {
    const response = await fetch((node as HTMLImageElement).src);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { type: response.headers.get('content-type'), width: new DataView(bytes.buffer).getUint32(16), height: new DataView(bytes.buffer).getUint32(20) };
  });
  expect(image.type).toBe('image/png');
  expect([1080, 2160]).toContain(image.width);
  expect([1080, 2160]).toContain(image.height);
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { sharedData?: unknown }).sharedData)).toEqual({
    url: 'https://nusantara.readynaz.com/', fileTypes: ['image/png'],
    title: 'Atlas Nusantara — Find your next favourite in Indonesia.',
    text: 'So many islands. So much to discover. Find your next favourite place, flavour or natural wonder on Atlas Nusantara.'
  });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('nusantara-snapshot.png');
  const stream = await download.createReadStream();
  if (!stream) throw new Error('PNG download stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const downloaded = Buffer.concat(chunks);
  expect(downloaded.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(downloaded.readUInt32BE(16)).toBe(image.width);
  await dialog.getByRole('button', { name: 'Close share preview' }).click();
  await page.getByRole('button', { name: 'Share this atlas', exact: true }).click();
  await expect(dialog.locator('.share-loading')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { shareCardPending?: boolean }).shareCardPending)).toBe(true);
  await dialog.getByRole('button', { name: 'Close share preview' }).click();
  await page.evaluate(() => (window as Window & { releaseShareCard?: () => void }).releaseShareCard?.());
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Share this atlas', exact: true })).toBeFocused();
});

test('copies the inviting caption and public link when native sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as Window & { copiedShare?: string }).copiedShare = text; }
    } });
  });
  await openAtlas(page);
  await page.getByRole('button', { name: 'Share this atlas', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this atlas' });
  await expect(dialog.locator('.share-preview')).toBeVisible({ timeout: 15_000 });
  const caption = await dialog.locator('.share-caption').innerText();
  await dialog.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { copiedShare?: string }).copiedShare)).toBe(caption + '\n\nhttps://nusantara.readynaz.com/');
  await expect(dialog.getByRole('status')).toHaveText('Public link copied.');
});

test('keeps the directory usable when geometry cannot be fetched', async ({ page }) => {
  await page.route('**/data/geometry-2025/**', route => route.fulfill({ status: 404 }));
  await openAtlas(page);
  await expect(page.locator('.region-table tbody tr')).toHaveCount(38);
  await page.getByRole('searchbox').fill('Papua Barat Daya');
  await expect(page.locator('.region-table tbody tr')).toHaveCount(1);
});

test('shows source and support links with one automatic advertising slot', async ({ page }) => {
  await openAtlas(page);
  await expect(page.getByRole('link', { name: /Source code/ })).toHaveAttribute('href', 'https://github.com/ygrip/nusantara');
  const support = page.locator('#support');
  for (const [name, href] of [['Trakteer', 'https://trakteer.id/yunaz_gilang'], ['Ko-fi', 'https://ko-fi.com/ygrip'], ['Patreon', 'https://www.patreon.com/c/ygrip']]) {
    await expect(support.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
  }
  await expect(support.getByText('Made with care', { exact: true })).toBeVisible();
  await expect(page.locator('ins[data-ad-slot="5292790825"]')).toHaveCount(1);
});

test('serves production-root canonical and OG metadata plus a local PNG image', async ({ page, request }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const metadata = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    title: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
  }));
  expect(metadata.canonical).toBe('https://nusantara.readynaz.com/');
  expect(metadata.ogUrl).toBe('https://nusantara.readynaz.com/');
  expect(metadata).toMatchObject({
    ogImage: 'https://nusantara.readynaz.com/og/nusantara.png?v=clay-discovery-2',
    title: 'Atlas Nusantara — Find your next favourite in Indonesia.',
    twitterTitle: 'Atlas Nusantara — Find your next favourite in Indonesia.',
    description: expect.stringContaining('places, local flavours, wildlife and weather'),
    ogDescription: expect.stringContaining('Pick a place, follow your curiosity, and start exploring.')
  });
  const image = await request.get('/og/nusantara.png?v=clay-discovery-2');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});

test('renders hot summary counts and cold archive-download controls from a local publication fixture', async ({ page }) => {
  const summaryData = {
    generatedAt: '2026-10-26T12:00:00.000Z', retentionDays: 365,
    summaryScope: 'retained observations, not a complete national total',
    counts: { warning: 3, earthquake: 2, incident: 0, hazard: 1 }, activeWarningCount: 3,
    observations: [], derivedInsights: [], derivedFacts: [],
    sources: [{ id: 'fixture', name: 'Local test fixture', status: 'healthy', intervalMinutes: 5, lastSuccessAt: '2026-10-26T11:55:00.000Z', sourceUrl: 'https://example.org/source', termsUrl: 'https://example.org/license' }]
  };
  const revision = '123e4567-e89b-42d3-a456-426614174000';
  await page.route('**/data/published/manifest.json', route => route.fulfill({ json: {
    schemaVersion: 1, revision, generatedAt: new Date().toISOString(), validUntil: new Date(Date.now() + 900000).toISOString(),
    summary: `/data/published/${revision}/summary.json`, snapshots: {}
  } }));
  await page.route(`**/data/published/${revision}/summary.json`, route => route.fulfill({ json: summaryData }));
  await page.route('**/api/**', route => route.fulfill({ status: 500, body: 'Browser must not read worker APIs' }));
  await openAtlas(page);
  const summary = page.locator('#summary');
  // Only the selected layer's collector is shown: the default weather layer shows weather warnings alone.
  await expect(summary.locator('.summary-counts article')).toHaveCount(1);
  await expect(summary.locator('.summary-counts article')).toContainText('Weather warnings');
  await expect(summary.locator('.summary-counts article')).toContainText('3');
  await expect(summary.locator('.archive-entry')).toHaveCount(1);
  await expect(summary.locator('.archive-entry button').first()).toBeVisible();
  await chooseLayer(page, 'Earthquakes');
  await expect(summary.locator('.summary-counts article')).toHaveCount(1);
  await expect(summary.locator('.summary-counts article')).toContainText('Earthquakes');
  await expect(summary.locator('.summary-counts article')).toContainText('2');
  await chooseLayer(page, 'Mountains');
  await expect(page.locator('#summary')).toHaveCount(0);
  await expect(page.locator('.section-nav a[href="#summary"]')).toHaveCount(0);
});

test('unmapped warnings remain visible with an explicit coverage caveat and official links', async ({ page }) => {
  const revision = '123e4567-e89b-42d3-a456-426614174000';
  const timestamp = new Date().toISOString();
  const validUntil = new Date(Date.now() + 600000).toISOString();
  await page.route('**/data/published/manifest.json', route => route.fulfill({ json: {
    schemaVersion: 1, revision, generatedAt: timestamp, validUntil,
    summary: `/data/published/${revision}/summary.json`, snapshots: { warning: `/data/published/${revision}/warning.json` }
  } }));
  await page.route(`**/data/published/${revision}/warning.json`, route => route.fulfill({ json: {
    schemaVersion: 1, generatedAt: timestamp,
    provenance: { source: 'BMKG', sourceUrl: 'https://www.bmkg.go.id/alerts/nowcast/id', sourcePublishedAt: timestamp, fetchedAt: timestamp, validUntil, license: 'CC0-1.0', licenseUrl: 'https://example.org/synthetic-fixture-license', reviewedBy: 'Synthetic test fixture', reviewedAt: timestamp, coverage: [], edition: null },
    records: Array.from({ length: 31 }, (_, index) => ({ id: 'fixture-' + index, type: 'warning', observedAt: timestamp, regionCodes: [], unmatchedRegionCodes: [], geometry: null, properties: { headline: 'Synthetic browser test warning ' + index, expires: validUntil, sourceLink: 'https://www.bmkg.go.id/alerts/nowcast/id/SYNTHETIC_alert.xml' } }))
  } }));
  await useEnglish(page);
  await page.goto('/?region=11');
  const panel = page.locator('.snapshot-panel');
  await expect(panel).toContainText('These records have no verified region assignment.');
  await expect(panel.locator('.warning-table tbody tr')).toHaveCount(30);
  await expect(panel.locator('.record-count')).toContainText('30 / 31');
  // A row opens a dialog with the full advisory and the official source link.
  await panel.locator('.row-action').first().click();
  await expect(page.getByRole('dialog').getByRole('link', { name: /Official alert/ })).toHaveAttribute('href', 'https://www.bmkg.go.id/alerts/nowcast/id/SYNTHETIC_alert.xml');
  await page.keyboard.press('Escape');
  await expect(panel).not.toContainText('No records in this snapshot');
});

test('expired hot counts disappear when a tab resumes instead of remaining apparently current', async ({ page }) => {
  const now = Date.now();
  await page.clock.setFixedTime(new Date(now));
  const revision = '123e4567-e89b-42d3-a456-426614174000';
  await page.route('**/data/published/manifest.json', route => route.fulfill({ json: {
    schemaVersion: 1, revision, generatedAt: new Date(now).toISOString(), validUntil: new Date(now + 60000).toISOString(),
    summary: `/data/published/${revision}/summary.json`, snapshots: {}
  } }));
  await page.route(`**/data/published/${revision}/summary.json`, route => route.fulfill({ json: {
    generatedAt: new Date(now).toISOString(), retentionDays: 365, counts: { warning: 1, earthquake: 0, incident: 0, hazard: 0 }, sources: [], observations: [], derivedFacts: []
  } }));
  await openAtlas(page);
  await expect(page.locator('#summary > .summary-counts article')).toHaveCount(1);
  await page.clock.setFixedTime(new Date(now + 61000));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#summary > .summary-counts article')).toHaveCount(0);
  await expect(page.locator('#summary .summary-empty')).toBeVisible();
});

test('zooms, pans, resets, and navigates fixture geometry into the real code hierarchy', async ({ page }) => {
  await page.route('**/data/geometry-2025/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    let fixture = syntheticFixture('11', 'Synthetic province fixture');
    if (pathname.endsWith('/provinces/11.json')) fixture = syntheticFixture('11.01', 'Synthetic city fixture');
    return route.fulfill({ json: fixture });
  });
  await openAtlas(page);
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const map = page.locator('.atlas-map');
  const scale = page.locator('.map-controls output');
  await expect(map.locator('path[data-code="11"]')).toBeVisible();
  const originalTransform = await map.locator('svg g').first().getAttribute('transform');
  await map.dispatchEvent('wheel', { deltaY: -120, bubbles: true });
  await expect(scale).not.toHaveText('1.0×');
  await expect(page.locator('.map-controls')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Tilt view' })).toHaveCount(0);
  const transformed = await map.locator('svg g').first().getAttribute('transform');
  expect(transformed).not.toBe(originalTransform);
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(scale).not.toHaveText('1.0×');
  await page.getByRole('button', { name: 'Reset map view' }).click();
  await expect(scale).toHaveText('1.0×');
  const resetTransform = await map.locator('svg g').first().getAttribute('transform');
  await map.scrollIntoViewIfNeeded();
  const box = await map.boundingBox();
  if (!box) throw new Error('Map has no layout box');
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 64, box.y + 54);
  await page.mouse.up();
  const pannedTransform = await map.locator('svg g').first().getAttribute('transform');
  expect(pannedTransform).not.toBe(resetTransform);
  await expect(scale).toHaveText('1.0×');
  await page.waitForTimeout(350);
  await map.getByRole('button', { name: 'Synthetic province fixture · 11' }).click({ force: true });
  await expect(page).toHaveURL(/region=11$/);
  await expect(page.locator('.atlas-breadcrumb')).toContainText('Aceh');
  await expect(page.locator('.region-table').getByRole('button', { name: /Kabupaten Aceh Selatan/ })).toBeVisible();
  await page.locator('.region-table').getByRole('button', { name: /Kabupaten Aceh Selatan/ }).click();
  await expect(page).toHaveURL(/region=11\.01$/);
  await expect(page.locator('.selected-region')).toContainText('11.01');
  await expect(page.locator('.selected-region')).not.toContainText('Code edition');
});

test('supports real two-finger pinch without zooming the document', async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only; desktop WebKit gestures are covered separately.');
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 375, height: 812 }, locale: 'en' });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/data/geometry-2025/**', route => route.fulfill({ json: syntheticFixture('11', 'Synthetic pinch fixture') }));
    await openAtlas(page);
    await page.getByRole('button', { name: '2D', exact: true }).click();
    const map = page.locator('.atlas-map');
    await expect(map.locator('path[data-code="11"]')).toBeVisible();
    await map.scrollIntoViewIfNeeded();
    const box = await map.boundingBox();
    if (!box) throw Error('Map has no layout box');
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 20, y, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 60, y, id: 1 }, { x: x + 60, y, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.map-controls output')).not.toHaveText('1.0×');
    expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
    await session.detach();
  } finally { await context.close(); }
});

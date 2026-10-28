import { expect, test, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import type { Landmark } from '../../src/lib/data/destination-contract';

test.use({ serviceWorkers: 'block' });
const starter = JSON.parse(readFileSync(new URL('../../static/data/destinations/v1.json', import.meta.url), 'utf8'));
const summaries = [...new Set<string>(starter.landmarks.map((place: { provinceCode: string }) => place.provinceCode))].map(provinceCode => {
  const places = starter.landmarks.filter((place: { provinceCode: string }) => place.provinceCode === provinceCode);
  return { provinceCode, count: places.length,
    natural: places.filter((place: { kind: string }) => place.kind === 'natural').length,
    built: places.filter((place: { kind: string }) => place.kind === 'built').length,
    shard: '/data/destinations/provinces/' + provinceCode + '.json' };
});
const fixtureIndex = { ...starter, schemaVersion: 2, license: 'Editorial fixture', attribution: 'Atlas Nusantara',
  provinces: summaries, coverage: { totalRecords: 76, classifiedRecords: 76, geocodedRecords: 0,
    licensedImages: 0, sourceCoveragePercent: null } };

function provinceFixture(code: string) {
  return starter.landmarks.filter((place: { provinceCode: string }) => place.provinceCode === code).map((place: Landmark) => {
    let sourceDistrict = 'Kabupaten Bandung';
    if (place.kind === 'built') sourceDistrict = 'Kota Bandung';
    return { ...place, officialId: place.id, sourceDistrict };
  });
}

/** Opens the searchable province popup, narrows it by typing and picks the first match. */
async function pickProvince(page: Page, name: string) {
  const trigger = page.locator('.destination-explorer .place-trigger');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Choose a province' });
  await dialog.getByRole('combobox').fill(name);
  await dialog.getByRole('option', { name: new RegExp('^' + name) }).first().click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.route('**/data/destinations/index.json?*', route => route.fulfill({ json: fixtureIndex }));
  await page.route('**/data/destinations/provinces/*.json?*', route => {
    const code = new URL(route.request().url()).pathname.split('/').pop()?.replace('.json', '') ?? '';
    return route.fulfill({ json: { ...starter, landmarks: provinceFixture(code) } });
  });
});

test('starts on the national view without a location lookup and selecting a province fetches only its static shard', async ({ page }) => {
  const shards: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/data/destinations/provinces/')) shards.push(pathname);
  });
  await page.goto('/?layer=destinations');
  await expect(page.locator('.destination-explorer .place-trigger')).toContainText('Choose a province');
  await expect(page.locator('.atlas-breadcrumb [aria-current="true"]')).toHaveText('National');
  expect(shards).toEqual([]);
  await pickProvince(page, 'Jawa Barat');
  await expect(page).toHaveURL(/region=32/);
  await expect(page.locator('.destination-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.destination-table')).toContainText('Kawah Putih');
  await expect(page.locator('.destination-table')).toContainText('Gedung Sate');
  expect(shards).toEqual(['/data/destinations/provinces/32.json']);
});

test('province popup is searchable, shows place counts and the search input fills its container', async ({ page }) => {
  await page.goto('/?layer=destinations&region=32');
  await page.locator('.destination-explorer .place-trigger').click();
  const dialog = page.getByRole('dialog', { name: 'Choose a province' });
  await dialog.getByRole('combobox').fill('bali');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await expect(dialog.getByRole('option').first()).toContainText('Destinations');
  await page.keyboard.press('Escape');
  const shell = page.locator('.destination-search');
  const input = shell.locator('input');
  const shellBox = await shell.boundingBox();
  const inputBox = await input.boundingBox();
  expect(shellBox && inputBox && inputBox.width > shellBox.width - 60).toBe(true);
  const filterBox = await page.locator('.destination-filters').boundingBox();
  expect(shellBox && filterBox && Math.abs(shellBox.width - filterBox.width) < 2).toBe(true);
});

test('table composes search and filters and supports accessible sorting without new data requests', async ({ page }) => {
  await page.goto('/?layer=destinations&region=32');
  const rows = page.locator('.destination-table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Gedung Sate');
  const nameHeader = page.getByRole('columnheader', { name: /Name/ });
  await nameHeader.getByRole('button').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first()).toContainText('Kawah Putih');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('natural');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Kawah Putih');
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('all');
  await page.getByRole('combobox', { name: 'District', exact: true }).selectOption('Kota Bandung');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Gedung Sate');
  await page.locator('.destination-search input').fill('curated-32-built');
  await expect(rows).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Photo', exact: true }).selectOption('with-image');
  await expect(page.getByRole('status').filter({ hasText: 'No matching landmarks.' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Photo', exact: true }).selectOption('all');
  await page.locator('.destination-search input').fill('');
  await pickProvince(page, 'Bali');
  await expect(page.getByRole('combobox', { name: 'District', exact: true })).toHaveValue('');
  await expect(rows).toHaveCount(2);
});

test('destination share cards use the destination photo when available', async ({ page }) => {
  await page.route('**/upload.wikimedia.org/**', route => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    headers: { 'access-control-allow-origin': '*' },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#18a6c2"/></svg>'
  }));
  await page.route('**/data/destinations/provinces/32.json?*', route => {
    const landmarks = provinceFixture('32');
    landmarks[0].image = { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.svg',
      descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.svg', credit: 'Fixture credit',
      license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', reviewedAt: '2026-10-27T00:00:00Z' };
    landmarks[0].images = [landmarks[0].image];
    return route.fulfill({ json: { ...starter, landmarks } });
  });
  await page.goto('/?layer=destinations&region=32');
  await page.locator('.destination-table tbody tr').filter({ hasText: provinceFixture('32')[0].name }).getByRole('button', { name: /Share/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('img')).toBeVisible();
  const color = await dialog.getByRole('img').evaluate(async node => {
    const image = node as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return [...context.getImageData(540, 400, 1, 1).data].slice(0, 3);
  });
  expect(color).toEqual([24, 166, 194]);
});

test('stored Commons photos show full creator credits and license links without runtime searches', async ({ page }) => {
  const creator = 'Commons Photographer — full creator credit remains visible';
  await page.route('**/upload.wikimedia.org/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#98b9aa"/></svg>'
  }));
  await page.route('**/data/destinations/provinces/32.json?*', route => {
    const landmarks = provinceFixture('32');
    landmarks[0].image = { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.jpg',
      descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.jpg', credit: creator,
      license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', reviewedAt: '2026-10-27T00:00:00Z' };
    return route.fulfill({ json: { ...starter, landmarks } });
  });
  const searches: string[] = [];
  page.on('request', request => { if (request.url().includes('/w/api.php')) searches.push(request.url()); });
  await page.goto('/?layer=destinations&region=32');
  const credit = page.getByRole('link', { name: creator + ' ↗', exact: true });
  await expect(credit).toBeVisible();
  await expect(credit).toHaveAttribute('href', 'https://commons.wikimedia.org/wiki/File:Fixture.jpg');
  await expect(page.getByRole('link', { name: 'CC-BY-SA-4.0', exact: true })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
  expect(searches).toEqual([]);
});

test('a province without reviewed photos retains placeholders', async ({ page }) => {
  await page.goto('/?layer=destinations&region=51');
  await expect(page.locator('.destination-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.destination-placeholder').first()).toContainText('No photo available');
});

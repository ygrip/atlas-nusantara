import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const index = JSON.parse(readFileSync(new URL('../../static/data/destinations/index.json', import.meta.url), 'utf8'));
const province = index.provinces.find((item: { provinceCode: string }) => item.provinceCode === '35');
const publishedProvince = JSON.parse(readFileSync(new URL('../../static/data/destinations/provinces/35.json', import.meta.url), 'utf8'));
const illustratedPlace = publishedProvince.landmarks.find((place: { image?: unknown }) => place.image);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.route(/https:\/\/(?:thumb|upload)\.wikimedia\.org\//, route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#98b9aa"/></svg>'
  }));
});

test('a real published catalog entry renders its stored Commons creator and license', async ({ page }) => {
  await page.goto('/?region=35');
  await page.locator('.destination-search input').fill(illustratedPlace.name);
  const credit = page.locator('.destination-table tbody tr').first().locator('.photo-credit');
  await expect(credit).toContainText(illustratedPlace.image.credit);
  await expect(credit.getByRole('link').first()).toHaveAttribute('href', illustratedPlace.image.descriptionUrl);
  await expect(credit.getByRole('link').last()).toHaveAttribute('href', illustratedPlace.image.licenseUrl);
});

test('selected province has client-side pagination, search, filters, and sorting without extra data fetches', async ({ page, context }) => {
  const shards: string[] = [];
  const aggregates: string[] = [];
  context.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/data/destinations/provinces/')) shards.push(pathname);
    if (pathname === '/data/destinations/national.json') aggregates.push(pathname);
  });
  await page.goto('/?region=35');
  await expect(page.locator('.destination-total')).toHaveText(String(province.count));
  const rows = page.locator('.destination-table tbody tr');
  await expect(rows).toHaveCount(25);
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  expect([...new Set(shards)]).toEqual(['/data/destinations/provinces/35.json']);
  expect(aggregates).toEqual([]);
  const firstName = await rows.first().locator('th[scope="row"]').textContent();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.pagination span')).toContainText('Page 2');
  await expect(rows).toHaveCount(25);
  await expect(rows.first().locator('th[scope="row"]')).not.toHaveText(firstName ?? '');
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).selectOption('10');
  await expect(rows).toHaveCount(10);
  await expect(page.locator('.pagination span')).toContainText('Page 1');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  const nameHeader = page.getByRole('columnheader', { name: /Name/ });
  await nameHeader.getByRole('button').click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('combobox', { name: 'Photo', exact: true }).selectOption('with-image');
  await expect(page.locator('.destination-placeholder')).toHaveCount(0);
  await expect(rows.first().locator('.photo-credit')).toBeVisible();
  await page.getByRole('combobox', { name: 'Photo', exact: true }).selectOption('all');
  await page.locator('.destination-search input').fill(illustratedPlace.officialId);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(illustratedPlace.name);
  expect([...new Set(shards)]).toEqual(['/data/destinations/provinces/35.json']);
  expect(aggregates).toEqual([]);
});

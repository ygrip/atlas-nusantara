import { expect, test, type Page } from './fixtures';
import { readFile } from 'node:fs/promises';

async function openExport(page: Page, url: string) {
  await page.addInitScript(() => localStorage.setItem('PARAGLIDE_LOCALE', 'en'));
  await page.goto(url);
  await expect(page.locator('.region-table tbody tr, .mountain-list tbody tr').first()).toBeVisible();
  await page.getByRole('button', { name: 'Export data' }).click();
  await expect(page.getByRole('dialog', { name: 'Export map data' })).toBeVisible();
}

async function downloadAs(page: Page, format: 'JSON' | 'CSV' | 'XML') {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: new RegExp('^' + format) }).click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test.describe('map data export', () => {
  test('weather layer exports every province as csv with coordinates and forecast columns', async ({ page }) => {
    await openExport(page, '/');
    await expect(page.getByRole('dialog')).toContainText('38 records');
    const { name, text } = await downloadAs(page, 'CSV');
    expect(name).toMatch(/^nusantara-warning-national-\d{8}\.csv$/);
    const lines = text.replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe('code,name,level,parent_code,parent_name,latitude,longitude,weather,temperature_c,humidity_pct,cloud_cover_pct,wind_speed_kmh,wind_from,forecast_time');
    expect(lines).toHaveLength(39);
    expect(lines.find(line => line.startsWith('31,'))).toMatch(/^31,Daerah Khusus Ibukota Jakarta,province,,,-6\.\d+,106\.\d+,/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('selected province exports its cities as json with source details', async ({ page }) => {
    await openExport(page, '/?region=51');
    await expect(page.getByRole('dialog')).toContainText('Bali');
    const { name, text } = await downloadAs(page, 'JSON');
    expect(name).toMatch(/^nusantara-warning-bali-\d{8}\.json$/);
    const data = JSON.parse(text);
    expect(data.metadata).toMatchObject({ layer: 'warning', scope: 'Bali', source: expect.stringContaining('BMKG') });
    expect(data.records.length).toBe(data.metadata.record_count);
    expect(data.records[0]).toMatchObject({ level: 'city-regency', parent_code: '51', parent_name: 'Bali' });
  });

  test('mountain layer exports pins as well-formed xml', async ({ page }) => {
    await openExport(page, '/?layer=mountains');
    const { name, text } = await downloadAs(page, 'XML');
    expect(name).toMatch(/^nusantara-mountains-national-\d{8}\.xml$/);
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(text).toContain('<records count="4636">');
    const parsed = await page.evaluate(xml => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      return { error: document.querySelector('parsererror')?.textContent ?? null, records: document.querySelectorAll('record').length };
    }, text);
    expect(parsed).toEqual({ error: null, records: 4636 });
  });
});

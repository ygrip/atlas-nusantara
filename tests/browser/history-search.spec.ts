import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

for (const width of [320, 375, 900, 1250]) {
  test(`polity browser searches all periods, changes year and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?layer=history');
    const panel = page.locator('.history-panel');
    const inventory = panel.locator('.inventory');
    await expect(inventory).not.toHaveAttribute('open', '');
    await inventory.locator('summary').click();
    await expect(inventory).toHaveAttribute('open', '');
    const search = panel.getByRole('searchbox', { name: 'Search kingdoms and polities' });
    await search.fill('kesultanan yogyakarta');
    const result = panel.locator('.polity-result');
    await expect(result).toHaveCount(1);
    await expect(result).toContainText('Kesultanan Yogyakarta');
    await result.click();
    await expect(panel.locator('.polity-detail h4')).toHaveText('Kesultanan Yogyakarta');
    expect(Number(await panel.getByRole('slider').inputValue())).toBeGreaterThanOrEqual(1755);
    await search.fill('not-a-real-polity');
    await expect(panel.locator('.search-empty')).toContainText('No matching polity');
    await expect(panel.locator('.inventory').getByRole('status')).toContainText('No inventory entries');
    await search.fill('Agang Nionjo');
    await expect(panel.locator('.inventory li')).toHaveCount(1);
    await expect(panel.locator('.inventory li')).toContainText('Agang Nionjo');
    await search.fill('');
    const bounds = await panel.locator('.polity-browser').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(panel.locator('.research-badge').first()).toHaveText('Research');
    await expect(panel.locator('.polity-result .result-context')).toHaveCount(0);
    await expect(panel.locator('.polity-results')).not.toContainText('Dates not established');
    const rows = await panel.locator('.polity-result').evaluateAll(elements => elements.slice(0, 15).map(element => {
      const bounds = element.getBoundingClientRect();
      const title = element.querySelector('strong')!.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, titleTop: title.top, titleBottom: title.bottom };
    }));
    expect(rows.every(row => row.titleTop >= row.top && row.titleBottom <= row.bottom)).toBe(true);
    expect(rows.every((row, index) => index === 0 || row.top >= rows[index - 1].bottom + 5)).toBe(true);
    const first = panel.locator('.polity-result').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    const browserBounds = await panel.locator('.polity-browser').boundingBox();
    const detailBounds = await panel.locator('.polity-detail').boundingBox();
    expect(Math.abs(browserBounds!.height - detailBounds!.height)).toBeLessThan(1);
    if (width < 620) {
      expect(Math.abs(browserBounds!.x - detailBounds!.x)).toBeLessThan(1);
      expect(detailBounds!.y).toBeGreaterThan(browserBounds!.y + browserBounds!.height);
    }
    await expect(search).toHaveCSS('box-shadow', 'none');
    await search.focus();
    await expect(panel.locator('.search-well')).toHaveCSS('outline-style', 'solid');
    await inventory.locator('summary').click();
    await expect(inventory).not.toHaveAttribute('open', '');
    await panel.screenshot({ path: `output/history-search-${width}.png` });
  });
}

for (const locale of ['en', 'id', 'ms', 'fil', 'th', 'vi', 'my', 'km', 'lo', 'zh-SG', 'ta', 'tet', 'pt-TL', 'ja']) {
  test(`history search and collapsed inventory are localized in ${locale}`, async ({ page }) => {
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
    let path = '/';
    if (locale !== 'en') path = `/${locale}/`;
    await page.goto(`${path}?layer=history`);
    const panel = page.locator('.history-panel');
    await expect(panel.getByRole('searchbox', { name: messages.history_search })).toHaveAttribute('placeholder', messages.history_search_hint);
    await expect(panel.locator('.scope-tabs button').first()).toContainText(messages.history_scope_active);
    await expect(panel.locator('.scope-tabs button').last()).toContainText(messages.history_scope_all);
    await expect(panel.locator('.research-badge').first()).toHaveText(messages.history_research_badge);
    await expect(panel.locator('a[href="https://github.com/Seshat-Global-History-Databank/cliopatria"]')).toContainText(messages.history_adapted);
    const inventory = panel.locator('.inventory');
    await expect(inventory).not.toHaveAttribute('open', '');
    await expect(inventory.locator('summary')).toContainText(messages.history_inventory);
    await inventory.locator('summary').click();
    await expect(inventory).toContainText(messages.history_inventory_note);
    await expect(panel.locator('.downloads small')).toHaveText(messages.history_export_detail);
    await panel.getByRole('button', { name: messages.export_button, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(messages.history_catalogue_scope);
    await page.keyboard.press('Escape');
    await panel.getByRole('slider').evaluate((element: HTMLInputElement) => { element.value = String(new Date().getUTCFullYear()); element.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(panel.locator('.polity-detail > .detail-heading h4')).toHaveText(messages.history_country_indonesia);
    await expect(panel.locator('.modern-status')).toContainText(messages.history_modern_timor_independent);
    await expect(page.locator('.history-labels .history-label').filter({ hasText: messages.history_country_indonesia })).toHaveCount(1);
    await expect(panel.locator('.place')).toContainText(messages.history_place_jakarta);
    await panel.getByRole('searchbox', { name: messages.history_search }).fill(messages.history_place_jakarta);
    await expect(panel.locator('.polity-result strong').filter({ hasText: messages.history_country_indonesia })).toBeVisible();
  });
}

test('research records are searchable without inventing timeline dates', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  const search = panel.getByRole('searchbox', { name: 'Search kingdoms and polities' });
  await expect(panel.locator('.scope-tabs button').last()).toContainText('975');
  await search.fill('Agang Nionjo');
  await panel.locator('.polity-result').click();
  await expect(panel.locator('.polity-detail h4')).toHaveText('Agang Nionjo');
  await expect(panel.locator('.polity-detail')).toContainText('Dates');
  await expect(panel.getByRole('slider')).toHaveValue('682');
});

for (const action of ['slider', 'milestone', 'active-scope', 'same-map-polity']) {
  test(`a research selection clears when using ${action}`, async ({ page }) => {
    await page.goto('/?layer=history');
    const panel = page.locator('.history-panel');
    await expect(panel.locator('.scope-tabs button').last()).toContainText('975');
    const search = panel.getByRole('searchbox', { name: 'Search kingdoms and polities' });
    await search.fill('Agang Nionjo');
    await panel.locator('.polity-result').click();
    await expect(panel.locator('.polity-detail h4')).toHaveText('Agang Nionjo');
    await search.fill('');
    if (action === 'slider') {
      await panel.getByRole('slider').evaluate((element: HTMLInputElement) => { element.value = '732'; element.dispatchEvent(new Event('input', { bubbles: true })); });
    } else if (action === 'milestone') {
      await panel.getByRole('button', { name: 'Next milestone' }).click();
    } else if (action === 'active-scope') {
      await panel.locator('.scope-tabs button').first().click();
    } else {
      await page.locator('.atlas-map .history-label-button[data-history-id="srivijaya"]').first().focus();
      await page.keyboard.press('Enter');
    }
    await expect(panel.locator('.polity-detail > .detail-heading h4')).toBeVisible();
    await expect(panel.locator('.polity-detail > .detail-heading h4')).not.toHaveText('Agang Nionjo');
    await expect(panel.locator('.polity-result[aria-pressed="true"]')).toHaveCount(1);
  });
}

test('curated polities expose their supplemental research and accent-insensitive names remain searchable', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  const supplemental = panel.locator('.supplemental-research');
  await expect(supplemental).toBeVisible();
  await supplemental.locator('summary').first().click();
  await expect(supplemental.locator('.supplemental-body')).toContainText('CC BY');
  await expect(panel.locator('.polity-detail h4')).toHaveCount(1);
  await panel.getByRole('searchbox', { name: 'Search kingdoms and polities' }).fill('aree');
  await expect(panel.locator('.polity-result')).toHaveCount(1);
  await expect(panel.locator('.polity-result strong')).toHaveText('Areë');
});

test('playback switches to active polities and removes expired Demak immediately', async ({ page }) => {
  await page.goto('/?layer=history');
  const panel = page.locator('.history-panel');
  const slider = panel.getByRole('slider');
  await slider.evaluate((element: HTMLInputElement) => { element.value = '1554'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await panel.locator('.play').click();
  await expect(panel.locator('.scope-tabs button').first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(1554);
  await panel.locator('.play').click();
  await expect(panel.locator('.polity-result').filter({ hasText: 'Kesultanan Demak' })).toHaveCount(0);
  await expect(page.locator('.history-territory[data-history-id="demak"]')).toHaveCount(0);
  await expect(panel.locator('.polity-browser')).not.toContainText('Verified data is unavailable');
});

test('downloaded history GeoJSON separates polities, territories and milestones', async ({ page }) => {
  await page.goto('/?layer=history');
  await page.locator('.history-panel').getByRole('button', { name: /export/i }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: /^GeoJSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.geojson$/);
  const path = await download.path();
  const data = JSON.parse(await readFile(path!, 'utf8'));
  expect(data.type).toBe('FeatureCollection');
  expect(data.metadata.snapshot_year).toBe(682);
  expect(data.features.some((feature: { geometry: unknown }) => feature.geometry !== null)).toBe(true);
  expect(data.features.length).toBeGreaterThanOrEqual(939);
  expect(data.research_sources.features.length).toBe(939);
  expect(data.discovery_inventory.features).toHaveLength(827);
  expect(data.features.every((feature: { id: string }) => Boolean(feature.id))).toBe(true);
  expect(data.milestones.length).toBeGreaterThan(20);
  expect(data.territories.features.length).toBeGreaterThan(35);
});

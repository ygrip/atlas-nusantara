import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

test.use({ serviceWorkers: 'block' });

const { locales } = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8')) as { locales: string[] };
const source = readFileSync('static/data/weather/forecast.json', 'utf8');

function catalog(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
}

async function prepareWeather(page: Page, description = 'Partly Cloudy', code = 2) {
  await page.addInitScript(() => {
    localStorage.setItem('PARAGLIDE_LOCALE', 'en');
    localStorage.setItem('nusantara:pins:v1', JSON.stringify([
      { id: 'region:51', type: 'region', code: '51', name: 'Bali', addedAt: new Date().toISOString() }
    ]));
  });
  const forecast = JSON.parse(source);
  for (const point of forecast.points) {
    for (const step of point.steps) {
      step.desc = description;
      step.weather = code;
    }
  }
  await page.route('**/data/**/forecast.json', route => route.fulfill({ json: forecast }));
}

async function expectWeatherLabels(page: Page, expected: string) {
  await expect(page.locator('.weather-place .temperature p').first()).toHaveText(expected);
  await expect(page.locator('.weather-place .temperature p').first()).not.toHaveAttribute('lang', 'en');
  await expect(page.locator('.selected-region .weather-line')).toHaveText(expected);
  await expect(page.locator('.weather-readout .readout-desc')).toContainText(expected);
  await expect(page.locator('.weather-panel .summary > div:first-child small')).toHaveText(expected);
  await expect(page.locator('.region-table tbody tr').first()).toContainText(expected);
}

for (const locale of locales) {
  test(`weather labels use ${locale} in saved places, details, readout, panel and table`, async ({ page }) => {
    await prepareWeather(page);
    let path = `/${locale}`;
    if (locale === 'en') path = '/';
    await page.goto(path + '?region=51');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expectWeatherLabels(page, catalog(locale).weather_condition_partly_cloudy);
  });
}

for (const condition of [
  { description: 'Light Rain', code: 61, key: 'weather_condition_light_rain' },
  { description: 'Unknown future provider wording', code: 999, key: 'weather_condition_unknown' }
]) {
  test(`Indonesian weather handles ${condition.description}`, async ({ page }) => {
    await prepareWeather(page, condition.description, condition.code);
    await page.goto('/id?region=51');
    await expectWeatherLabels(page, catalog('id')[condition.key]);
  });
}

test('weather labels follow language changes without reloading the forecast', async ({ page }) => {
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/forecast.json')) requests++; });
  await prepareWeather(page);
  await page.goto('/?region=51');
  await expectWeatherLabels(page, catalog('en').weather_condition_partly_cloudy);
  const initialRequests = requests;
  for (const locale of ['id', 'th', 'zh-SG', 'en']) {
    await page.locator('.language-trigger').click();
    await page.locator(`.language-grid button[lang="${locale}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expectWeatherLabels(page, catalog(locale).weather_condition_partly_cloudy);
  }
  expect(requests).toBe(initialRequests);
});

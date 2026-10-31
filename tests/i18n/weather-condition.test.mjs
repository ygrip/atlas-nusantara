import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { weatherConditionKey } from '../../src/lib/i18n/weather-condition.ts';

const conditions = [
  ['Sunny', 'sunny'], ['Clear', 'sunny'], ['Partly Cloudy', 'partly_cloudy'],
  ['Mostly Cloudy', 'mostly_cloudy'], ['Cloudy', 'cloudy'], ['Overcast', 'overcast'],
  ['Mist/Haze', 'mist_haze'], ['Fog/Smoke', 'fog_smoke'], ['Light Rain', 'light_rain'],
  ['Moderate Rain', 'moderate_rain'], ['Heavy Rain', 'heavy_rain'], ['Rain', 'rain'], ['Drizzle', 'drizzle'],
  ['Showers', 'showers'], ['Rain Showers', 'showers'], ['Local Rain', 'showers'],
  ['Thunder', 'thunder'], ['Thunderstorm', 'thunderstorm'], ['Thunderstorms', 'thunderstorm'],
  ['  PARTLY   CLOUDY  ', 'partly_cloudy'], [' Mist / Haze ', 'mist_haze'],
  ['', 'unknown'], ['Unrecognized provider condition', 'unknown'], ['constructor', 'unknown']
];

for (const [description, condition] of conditions) {
  test(`weather description ${JSON.stringify(description)} resolves to ${condition}`, () => {
    assert.equal(weatherConditionKey(description), 'weather_condition_' + condition);
  });
}

test('every weather condition has a nonempty translation in all 14 locales', () => {
  const { locales } = JSON.parse(readFileSync('project.inlang/settings.json', 'utf8'));
  const keys = new Set(conditions.map(([description]) => weatherConditionKey(description)));
  assert.equal(locales.length, 14);
  assert.equal(keys.size, 16);
  for (const locale of locales) {
    const catalog = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8'));
    for (const key of keys) assert.ok(catalog[key]?.trim(), `${locale}: ${key}`);
  }
});

test('every condition in the bundled BMKG forecast is recognized without altering provider data', () => {
  const forecast = JSON.parse(readFileSync('static/data/weather/forecast.json', 'utf8'));
  const descriptions = new Set(forecast.points.flatMap(point => point.steps.map(step => step.desc)));
  for (const description of descriptions) {
    assert.notEqual(weatherConditionKey(description), 'weather_condition_unknown', description);
  }
  // BMKG currently calls code 61 Light Rain, despite older code tables calling it Moderate Rain.
  const providerStep = { weather: 61, desc: 'Light Rain' };
  assert.equal(weatherConditionKey(providerStep.desc), 'weather_condition_light_rain');
});

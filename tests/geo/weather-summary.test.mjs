import assert from 'node:assert/strict';
import test from 'node:test';
import { focusForecast, forecastCoordinates, pointInRegion, summariseWeather } from '../../src/lib/map/weather-summary.ts';
import { regionCoordinatesByCode } from '../../src/lib/atlas/region-coordinates.ts';
import { projectLonLat, unprojectToLonLat } from '../../src/lib/map/geometry.ts';
import { NATIONAL_FACTS, countUpValue } from '../../src/lib/atlas/national-facts.ts';

const AT = '2025-01-01T00:00:00Z';

function step(overrides) {
  return { at: AT, t: 28, hu: 80, tcc: 40, tp: 0, weather: 1, desc: 'Cerah Berawan', wd: 90, ws: 10, ...overrides };
}

function point(code, lon, lat, overrides) {
  return { code, adm4: code + '.01.01.1001', lon, lat, steps: [step(overrides)] };
}

const forecast = {
  schemaVersion: 1, kind: 'forecast-snapshot', source: 'BMKG', sourceUrl: 'https://api.bmkg.go.id', attribution: 'BMKG', codeEdition: 'x',
  fetchedAt: AT, validFrom: AT, validTo: AT, coverage: { requested: 3, received: 3 },
  points: [point('11.01', 95, 5), point('11.02', 96, 4, { desc: 'Hujan Ringan', weather: 61, tp: 4, t: 24 }), point('12.01', 99, 3, { desc: 'Petir', weather: 95 })]
};

test('pointInRegion matches a city exactly and a province by prefix only', () => {
  assert.equal(pointInRegion('11.01', '11.01'), true);
  assert.equal(pointInRegion('11.01', '11'), true);
  assert.equal(pointInRegion('111.01', '11'), false);
  assert.equal(pointInRegion('12.01', '11'), false);
});

test('summariseWeather describes a city and averages a province', () => {
  assert.equal(summariseWeather(forecast, '11.01', AT)?.description, 'Cerah Berawan');
  assert.equal(summariseWeather(forecast, '11', AT)?.temperature, 26);
  assert.equal(summariseWeather(forecast, '99', AT), undefined);
  assert.equal(summariseWeather(forecast, '11.01', undefined), undefined);
});

test('focusForecast keeps only the selected area so a cloudy area has no thunder', () => {
  assert.deepEqual(focusForecast(forecast, '11.01').points.map(item => item.code), ['11.01']);
  assert.equal(focusForecast(forecast, '11').points.length, 2);
  assert.equal(focusForecast(forecast, '99'), undefined);
});

test('forecastCoordinates averages the points of a province', () => {
  assert.deepEqual(forecastCoordinates(forecast, '11'), { lat: 4.5, lon: 95.5 });
});

test('unprojectToLonLat inverts projectLonLat and region centres use the bounding box', () => {
  const projection = { scale: 1186.2356, translate: [-1943.6258, 196.5938] };
  const plane = projectLonLat(projection, 106.83, -6.23);
  const back = unprojectToLonLat(projection, plane.x, plane.y);
  assert.ok(Math.abs(back.lon - 106.83) < 1e-6 && Math.abs(back.lat + 6.23) < 1e-6);
  const centres = regionCoordinatesByCode([{ sourceCode: '31', bbox: [plane.x - 2, plane.y - 2, plane.x + 2, plane.y + 2] }], projection);
  assert.ok(Math.abs(centres.get('31').lat + 6.23) < 0.01);
  assert.equal(regionCoordinatesByCode([{ sourceCode: '31', bbox: [0, 0, 1, 1] }], undefined).size, 0);
});

test('national facts are positive, unique and the count-up eases to its target', () => {
  assert.equal(new Set(NATIONAL_FACTS.map(fact => fact.id)).size, 6);
  assert.ok(NATIONAL_FACTS.every(fact => fact.value > 0));
  assert.equal(countUpValue(0, 100, 0, 1000), 0);
  assert.equal(countUpValue(0, 100, 1000, 1000), 100);
  assert.ok(countUpValue(0, 100, 500, 1000) > 50);
  assert.equal(countUpValue(20, 40, 10, 0), 40);
});

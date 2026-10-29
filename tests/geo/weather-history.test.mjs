import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isWeatherHistory, nearestNeighbour, regionHistory, MAX_NEIGHBOUR_KM } from '../../src/lib/data/weather-history-contract.ts';
import { bandPath, linePath, METRIC_DEFINITIONS, valueScale } from '../../src/lib/data/weather-history-chart.ts';
import { summariseWeather } from '../../src/lib/map/weather-summary.ts';
import { isForecastSnapshot } from '../../src/lib/map/weather.ts';
import { CODE_EDITION } from '../../src/lib/atlas/edition.ts';

const DAYS = ['2026-10-27', '2026-10-28'];

function point(code, lat, lon, tmean) {
  const column = values => values.map(value => (value === null ? null : value));
  return { code, lat, lon, tmean: column(tmean), tmin: column(tmean), tmax: column(tmean), rain: column(tmean), hu: column(tmean), tcc: column(tmean), ws: column(tmean) };
}

function history(points) {
  return { schemaVersion: 1, kind: 'weather-history', source: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/', license: 'CC BY 4.0', attribution: 'x', codeEdition: 'e', fetchedAt: '2026-10-29T01:00:00Z', timeZone: 'Asia/Jakarta', days: DAYS, units: {}, points };
}

const sample = history([
  point('11.01', 3, 97, [20, 22]),
  point('11.02', 3.5, 97.5, [24, 26]),
  point('11.03', 3.2, 97.2, [null, null]),
  point('12.01', 2, 99, [30, 32]),
  point('99.01', -8, 140, [null, null])
]);

test('a city with its own history uses it and a province averages its cities with data', () => {
  assert.deepEqual(regionHistory(sample, '11.01').series.tmean, [20, 22]);
  const province = regionHistory(sample, '11');
  assert.equal(province.scope, 'province');
  assert.equal(province.cities, 2);
  assert.deepEqual(province.series.tmean, [22, 24]);
  assert.equal(province.neighbour, undefined);
});

test('the national series averages every point that has data', () => {
  const national = regionHistory(sample);
  assert.equal(national.scope, 'national');
  assert.equal(national.cities, 3);
  assert.deepEqual(national.series.tmean, [24.7, 26.7]);
});

test('a city without history borrows the nearest city that has some, and says which', () => {
  const result = regionHistory(sample, '11.03');
  assert.equal(result.neighbour.code, '11.01');
  assert.ok(result.neighbour.distanceKm < 100);
  assert.deepEqual(result.series.tmean, [20, 22]);
});

test('a city with no history and no neighbour in range, or an unknown code, has no history at all', () => {
  assert.equal(regionHistory(sample, '99.01'), undefined);
  assert.equal(regionHistory(sample, '77.01'), undefined);
  assert.equal(regionHistory(history([point('99.01', -8, 140, [null, null])])), undefined);
});

test('nearestNeighbour respects the distance limit', () => {
  const candidates = [{ code: 'a', lat: 0, lon: 0 }, { code: 'b', lat: 0, lon: 1 }];
  assert.equal(nearestNeighbour(candidates, { lat: 0, lon: 0.8 }).code, 'b');
  assert.equal(nearestNeighbour(candidates, { lat: 10, lon: 10 }), undefined);
  assert.equal(nearestNeighbour(candidates, { lat: 10, lon: 10 }, 5000).code, 'b');
  assert.equal(MAX_NEIGHBOUR_KM, 250);
});

test('the committed history file is valid, covers every city and has seven days', async () => {
  const value = JSON.parse(await readFile('static/data/weather/history.json', 'utf8'));
  assert.equal(isWeatherHistory(value), true);
  assert.equal(value.days.length, 7);
  const cities = JSON.parse(await readFile('static/data/admin-2025/forecast-points.json', 'utf8')).points;
  assert.deepEqual(value.points.map(item => item.code).sort(), cities.map(item => item.code).sort());
});

test('malformed history is rejected', () => {
  assert.equal(isWeatherHistory({ ...sample, days: ['not-a-date'] }), false);
  assert.equal(isWeatherHistory({ ...sample, points: [{ ...sample.points[0], tmean: [1] }] }), false);
  assert.equal(isWeatherHistory({ ...sample, kind: 'other' }), false);
});

test('axes start at zero for rain and fit the range for temperature, and an empty chart still has an axis', () => {
  const [temperature, rain] = METRIC_DEFINITIONS;
  const fitted = valueScale([[26, 28, 31]], temperature);
  assert.ok(fitted.min > 0 && fitted.min <= 26 && fitted.max >= 31);
  assert.equal(valueScale([[0, 12.5]], rain).min, 0);
  assert.ok(valueScale([[null, null]], temperature).ticks.length > 1);
  assert.deepEqual(valueScale([[50]], METRIC_DEFINITIONS[2]).ticks, [0, 25, 50, 75, 100]);
});

test('a missing day breaks the line and a band needs two complete days', () => {
  const x = index => index * 10;
  const y = value => value;
  assert.equal(linePath([1, null, 3, 4], x, y), 'M0.0 1.0M20.0 3.0L30.0 4.0');
  assert.equal(linePath([null, null], x, y), '');
  assert.equal(bandPath([1, null], [2, null], x, y), '');
  assert.match(bandPath([1, 2], [3, 4], x, y), /^M0\.0 3\.0 L10\.0 4\.0 L10\.0 2\.0 L0\.0 1\.0 Z$/);
});

function step(at, t) { return { at, t, hu: 80, tcc: 50, tp: 0, weather: 1, desc: 'Sunny', wd: 90, ws: 10 }; }
const time = '2026-10-29T03:00:00Z';
const forecast = {
  schemaVersion: 1, kind: 'forecast-snapshot', source: 'BMKG', sourceUrl: 'https://data.bmkg.go.id/prakiraan-cuaca/', attribution: 'x', codeEdition: CODE_EDITION,
  fetchedAt: '2026-10-29T01:00:00Z', validFrom: time, validTo: time, coverage: { requested: 3, received: 2 },
  points: [
    { code: '11.01', adm4: 'a', lat: 3, lon: 97, steps: [step(time, 27)] },
    { code: '12.01', adm4: 'b', lat: 2, lon: 99, steps: [step(time, 31)] }
  ],
  unavailable: [{ code: '11.03', lat: 3.2, lon: 97.2 }]
};

test('a city BMKG returned nothing for shows the nearest forecast with a neighbour marker', () => {
  assert.equal(isForecastSnapshot(forecast), true);
  assert.equal(isForecastSnapshot({ ...forecast, unavailable: [{ code: 'bad', lat: 0, lon: 0 }] }), false);
  const own = summariseWeather(forecast, '11.01', time);
  assert.equal(own.temperature, 27);
  assert.equal(own.neighbour, undefined);
  const borrowed = summariseWeather(forecast, '11.03', time);
  assert.equal(borrowed.temperature, 27);
  assert.equal(borrowed.neighbour.code, '11.01');
  assert.equal(summariseWeather(forecast, '77.01', time), undefined);
  assert.equal(summariseWeather({ ...forecast, unavailable: undefined }, '11.03', time), undefined);
});

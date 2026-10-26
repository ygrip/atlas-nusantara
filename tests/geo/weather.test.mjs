import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildField, forecastStepAt, forecastTimes, nearestTimeIndex, packField, rainIntensity, sampleChannel } from '../../src/lib/map/weather.ts';
import { projectLonLat } from '../../src/lib/map/geometry.ts';

const time = '2026-10-26T12:00:00Z';
const projection = { scale: 100, translate: [500, 250] };
function snapshot(direction) {
  return { points: [{ code: '32.01', lon: 0, lat: 0, steps: [{ at: time, wd: direction, ws: 20, tcc: 70, weather: 61, tp: 1 }] }] };
}

for (const [direction, east, south] of [[0, 0, 20], [90, -20, 0], [180, 0, -20], [270, 20, 0]]) {
  test(`meteorological wind from ${direction}° moves in the correct map direction`, () => {
    const field = buildField(snapshot(direction), time, projection);
    assert.ok(Math.abs(sampleChannel(field, field.u, 500, 250) - east) < 0.01);
    assert.ok(Math.abs(sampleChannel(field, field.v, 500, 250) - south) < 0.01);
    const bytes = packField(field);
    assert.equal(bytes.length, field.width * field.height * 4);
  });
}

test('rain and thunder are derived from forecast codes and amounts', () => {
  for (const [weather, tp, expected] of [[0, 0, 0], [61, 0, 0.35], [63, 0, 0.8], [95, 0, 0.9], [0, 15, 1]]) {
    assert.equal(rainIntensity({ weather, tp }), expected);
  }
  const data = snapshot(90);
  data.points[0].steps[0].weather = 17;
  assert.equal(buildField(data, time, projection).thunder.length, 1);
});

test('readouts use the same nearby forecast step as the field when national timeline hours differ', () => {
  const point = snapshot(90).points[0];
  assert.equal(forecastStepAt(point, '2026-10-26T13:00:00Z')?.at, time);
  assert.equal(forecastStepAt(point, '2026-10-26T18:00:00Z'), undefined);
});

test('forecasts outside the three-hour matching tolerance do not contribute weather', () => {
  const field = buildField(snapshot(90), '2026-11-01T12:00:00Z', projection);
  assert.ok(field.u.every(value => value === 0));
  assert.ok(field.cloud.every(value => value === 0));
});

test('Mercator placement uses the same coordinates as the generated relief and boundaries', () => {
  const origin = projectLonLat(projection, 0, 0);
  assert.ok(Math.abs(origin.x - 500) < 0.001);
  assert.ok(Math.abs(origin.y - 250) < 0.001);
  assert.ok(projectLonLat(projection, 10, 10).x > origin.x);
  assert.ok(projectLonLat(projection, 10, 10).y < origin.y);
});

test('forecast timeline is unique, sorted and selects the closest step', () => {
  const data = { points: [{ steps: [{ at: '2026-10-26T15:00:00Z' }, { at: time }, { at: time }] }] };
  const times = forecastTimes(data);
  assert.deepEqual(times, [time, '2026-10-26T15:00:00Z']);
  assert.equal(nearestTimeIndex(times, Date.parse('2026-10-26T14:30:00Z')), 1);
});

test('shipped snapshot covers all 514 unique regencies/cities using the verified Papua crosswalk', async () => {
  const forecast = JSON.parse(await readFile('static/data/weather/forecast.json', 'utf8'));
  const cities = JSON.parse(await readFile('static/data/admin-2025/cities.json', 'utf8')).regions;
  assert.deepEqual(forecast.points.map(point => point.code).sort(), cities.map(city => city.code).sort());
  assert.deepEqual(forecast.coverage, { requested: 514, received: 514 });
  const pairs = [['96.02', '96.04', 'Sorong Selatan'], ['96.03', '96.05', 'Raja Ampat'], ['96.04', '96.09', 'Tambrauw'], ['96.05', '96.10', 'Maybrat']];
  for (const [code, providerCode, name] of pairs) {
    const point = forecast.points.find(item => item.code === code);
    assert.equal(point.providerCode, providerCode);
    assert.equal(point.name, name);
    assert.ok(point.adm4.startsWith(providerCode + '.'));
  }
  for (const point of forecast.points) {
    assert.ok(Number.isFinite(point.lon) && Number.isFinite(point.lat), point.code);
    assert.ok(point.steps.length > 0, point.code);
    for (const step of point.steps) {
      assert.ok(Number.isFinite(Date.parse(step.at)), point.code);
      for (const key of ['t', 'hu', 'tcc', 'tp', 'wd', 'ws']) assert.ok(Number.isFinite(step[key]), point.code + ':' + key);
    }
  }
});

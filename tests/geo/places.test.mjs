import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, forecastForPlace } from '../../src/lib/places/forecast.ts';

const at = '2026-10-26T12:00:00Z';
const makePoint = (code, lat, lon) => ({ code, lat, lon, steps: [{ at, t: 28 }, { at: '2026-10-26T15:00:00Z', t: 30 }] });
const snapshot = { points: [makePoint('32.01', -6.5, 106.8), makePoint('32.73', -6.9, 107.6), makePoint('31.71', -6.1, 106.8)] };

test('saved city uses that city’s forecast and the closest dated step', () => {
  const result = forecastForPlace(snapshot, { type: 'region', code: '32.73' }, Date.parse('2026-10-26T14:40:00Z'));
  assert.equal(result.point.code, '32.73');
  assert.equal(result.step.t, 30);
});

test('device coordinates are matched locally to the nearest forecast point', () => {
  const result = forecastForPlace(snapshot, { type: 'coordinates', lat: -6.11, lng: 106.81 }, Date.parse(at));
  assert.equal(result.point.code, '31.71');
  assert.ok(result.distanceKm > 1 && result.distanceKm < 2);
});

test('province samples stay inside that province and missing regions do not borrow unrelated forecasts', () => {
  assert.ok(forecastForPlace(snapshot, { type: 'region', code: '32' }, Date.parse(at)).point.code.startsWith('32.'));
  assert.equal(forecastForPlace(snapshot, { type: 'region', code: '96' }, Date.parse(at)), undefined);
});

test('distance handles identical points and long distances', () => {
  for (const [a, b, expected] of [[[0, 0], [0, 0], 0], [[0, 0], [0, 1], 111.195]]) {
    assert.ok(Math.abs(distanceKm(...a, ...b) - expected) < 0.01);
  }
});

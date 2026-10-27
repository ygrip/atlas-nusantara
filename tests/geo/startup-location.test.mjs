import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { provinceAtPosition, DEFAULT_DESTINATION_PROVINCE } from '../../src/lib/geo/province-location.ts';
import { requestStartupLocation } from '../../src/lib/pwa/startup-location.ts';

const geometry = JSON.parse(readFileSync(new URL('../../static/data/geometry-2025/national.json', import.meta.url), 'utf8'));

for (const [name, latitude, longitude, expected] of [
  ['Jakarta', -6.2, 106.8456, '31'],
  ['Bali', -8.4095, 115.1889, '51'],
  ['Yogyakarta', -7.7956, 110.3695, '34'],
  ['Singapore inside the national bounding box', 1.3521, 103.8198, undefined],
  ['Sydney', -33.8688, 151.2093, undefined],
  ['invalid coordinates', Number.NaN, 106, undefined]
]) {
  test(`resolves ${name} using province polygons`, () => {
    assert.equal(provinceAtPosition(geometry, latitude, longitude), expected);
  });
}

test('Jakarta is the fallback without inventing an overseas province match', () => {
  assert.equal(DEFAULT_DESTINATION_PROVINCE, '31');
  assert.equal(provinceAtPosition(undefined, -6.2, 106.8), undefined);
});

test('requests low-accuracy device coordinates without sending or persisting them', async () => {
  let options;
  const provider = { getCurrentPosition(success, _failure, suppliedOptions) {
    options = suppliedOptions;
    success({ coords: { latitude: -8.4, longitude: 115.1, altitude: 999 } });
  } };
  const result = await requestStartupLocation(provider, new AbortController().signal, 100);
  assert.deepEqual(result, { latitude: -8.4, longitude: 115.1 });
  assert.deepEqual(options, { enableHighAccuracy: false, timeout: 100, maximumAge: 60000 });
});

test('denied, unavailable, aborted and unanswered location requests settle to fallback', async () => {
  const denied = { getCurrentPosition(_success, failure) { failure({ code: 1 }); } };
  assert.equal(await requestStartupLocation(denied, new AbortController().signal), undefined);
  assert.equal(await requestStartupLocation(undefined, new AbortController().signal), undefined);
  let lateSuccess;
  const waiting = { getCurrentPosition(success) { lateSuccess = success; } };
  const controller = new AbortController();
  const aborted = requestStartupLocation(waiting, controller.signal, 1000);
  controller.abort();
  assert.equal(await aborted, undefined);
  assert.equal(await requestStartupLocation(waiting, new AbortController().signal, 5), undefined);
  lateSuccess({ coords: { latitude: -8.4, longitude: 115.1 } });
});

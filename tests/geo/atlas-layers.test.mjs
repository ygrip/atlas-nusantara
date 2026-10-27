import test from 'node:test';
import assert from 'node:assert/strict';
import { mountainColor, validatePointOverlay } from '../../src/lib/map/overlay-contract.ts';

const overlay = {
  id: 'mountains', color: '#54765b', symbol: 'triangle', source: 'BIG',
  fetchedAt: '2026-10-27T00:00:00Z', legend: [],
  pins: [{ id: 'mountain-1', label: 'Mountain', lon: 110, lat: -7 }]
};

for (const [category, expected] of [['active', '#ca5a48'], ['potential', '#c99245'], ['other', undefined]]) {
  test(`mountain colour is consistent for ${category} in both renderers`, () => {
    assert.equal(mountainColor({ ...overlay.pins[0], category }), expected);
  });
}

for (const [provinceCode, valid] of [['32', true], ['123', false], ['javascript:1', false]]) {
  test(`province summary identity ${provinceCode} is validated`, () => {
    assert.equal(validatePointOverlay({ ...overlay, pins: [{ ...overlay.pins[0], provinceCode }] }), valid);
  });
}

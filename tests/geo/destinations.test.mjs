import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDestinationCatalog } from '../../src/lib/data/destination-contract.ts';

const catalog = JSON.parse(readFileSync(new URL('../../static/data/destinations/v1.json', import.meta.url), 'utf8'));

test('starter destination index covers all 38 provinces with both categories', () => {
  assert.equal(validateDestinationCatalog(catalog), true);
  const provinceKinds = new Map();
  for (const place of catalog.landmarks) {
    const kinds = provinceKinds.get(place.provinceCode) ?? new Set();
    kinds.add(place.kind);
    provinceKinds.set(place.provinceCode, kinds);
  }
  assert.equal(provinceKinds.size, 38);
  for (const kinds of provinceKinds.values()) assert.deepEqual([...kinds].sort(), ['built', 'natural']);
});
test('destination validator rejects invalid provenance and location', () => {
  assert.equal(validateDestinationCatalog({ ...catalog, landmarks: [...catalog.landmarks, { ...catalog.landmarks[0], id: 'bad', provinceCode: '99' }] }), false);
  assert.equal(validateDestinationCatalog({ ...catalog, landmarks: [...catalog.landmarks, { ...catalog.landmarks[0], id: 'bad', lon: 300, lat: 1 }] }), false);
  assert.equal(validateDestinationCatalog({ ...catalog, landmarks: [...catalog.landmarks, { ...catalog.landmarks[0] }] }), false);
});

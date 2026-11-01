import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { territoryPath } from '../../src/lib/map/history-territories.ts';
import { HISTORICAL_POLITIES } from '../../src/lib/data/history.ts';

const data = JSON.parse(await readFile(new URL('../../static/data/history-territories.geojson', import.meta.url), 'utf8'));

test('dated historical features identify existing polities and preserve closed polygon rings', () => {
  const ids = new Set(HISTORICAL_POLITIES.map(polity => polity.id));
  assert.equal(data.type, 'FeatureCollection');
  assert.ok(new Set(data.features.map(feature => feature.properties.id)).size >= 30);
  for (const feature of data.features) {
    assert.ok(ids.has(feature.properties.id));
    assert.ok(feature.properties.from <= feature.properties.to);
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
    let polygons = feature.geometry.coordinates;
    if (feature.geometry.type === 'Polygon') polygons = [polygons];
    for (const polygon of polygons) for (const ring of polygon) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) < 90));
    }
  }
});

test('projection retains multiple islands and holes as separate closed paths', () => {
  const ring = [[100, 0], [101, 0], [101, 1], [100, 0]];
  const feature = { geometry: { type: 'MultiPolygon', coordinates: [[ring, ring], [ring]] } };
  const path = territoryPath(feature, { scale: 100, translate: [0, 0] });
  assert.equal((path.match(/M/g) ?? []).length, 3);
  assert.equal((path.match(/Z/g) ?? []).length, 3);
  assert.ok(!path.includes('NaN'));
});

test('Majapahit reconstruction changes on its inclusive source date boundary', () => {
  const features = data.features.filter(feature => feature.properties.id === 'majapahit');
  assert.ok(features.some(feature => feature.properties.from <= 1351 && feature.properties.to === 1351));
  assert.ok(features.some(feature => feature.properties.from === 1352 && feature.properties.to >= 1352));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { activeHistoricalTerritories, territoryPath } from '../../src/lib/map/history-territories.ts';
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

test('Sukadana features map only to their documented Tanjungpura catalogue period', () => {
  const features = data.features.filter(feature => feature.properties.id === 'tanjungpura');
  assert.ok(features.length > 0);
  assert.ok(features.every(feature => feature.properties.sourceName === 'Sultanate of Sukadana' && feature.properties.from >= 1619 && feature.properties.to <= 1833));
});

test('expired, not-yet-active and out-of-catalogue source polygons are hidden', () => {
  const source = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { id: 'polity', from: 10, to: 20 }, geometry: { type: 'Polygon', coordinates: [] } },
    { type: 'Feature', properties: { id: 'polity', from: 21, to: 30 }, geometry: { type: 'Polygon', coordinates: [] } },
    { type: 'Feature', properties: { id: 'orphan', from: 10, to: 30 }, geometry: { type: 'Polygon', coordinates: [] } }
  ] };
  const catalog = new Map([['polity', { from: 15, to: 25 }]]);
  assert.deepEqual(activeHistoricalTerritories(source, catalog, 14), []);
  assert.deepEqual(activeHistoricalTerritories(source, catalog, 15), [source.features[0]]);
  assert.deepEqual(activeHistoricalTerritories(source, catalog, 21), [source.features[1]]);
  assert.deepEqual(activeHistoricalTerritories(source, catalog, 26), []);
  assert.deepEqual(activeHistoricalTerritories(source, catalog, 25), [source.features[1]]);
  assert.deepEqual(activeHistoricalTerritories(undefined, catalog, 20), []);
});

test('Majapahit reconstruction changes on its inclusive source date boundary', () => {
  const features = data.features.filter(feature => feature.properties.id === 'majapahit');
  assert.ok(features.some(feature => feature.properties.from <= 1351 && feature.properties.to === 1351));
  assert.ok(features.some(feature => feature.properties.from === 1352 && feature.properties.to >= 1352));
});

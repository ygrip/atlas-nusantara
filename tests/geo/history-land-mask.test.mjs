import test from 'node:test';
import assert from 'node:assert/strict';
import { clipHistoricalTerritories, nationalLandGeoJson } from '../../scripts/geo/history-land-mask.mjs';
import national from '../../static/data/geometry-2025/national.json' with { type: 'json' };
import manifest from '../../static/data/geometry-2025/manifest.json' with { type: 'json' };
import { projectLonLat, unprojectToLonLat } from '../../src/lib/map/projection.ts';

const projection = national.projection;
function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return geometry.coordinates;
}
const signedArea = ring => ring.slice(0, -1).reduce((total, point, index) => {
  const next = ring[index + 1];
  return total + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;

test('the exact national SVG land paths close, group and preserve all base-map rings', () => {
  const land = nationalLandGeoJson(national, projection);
  const rings = land.features.flatMap(feature => polygonsOf(feature.geometry).flat());
  assert.equal(land.features.length, 38);
  assert.equal(rings.length, 617);
  for (const ring of rings) {
    assert.ok(ring.length >= 4);
    assert.deepEqual(ring[0], ring.at(-1));
    assert.ok(ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  }
  const holes = land.features.flatMap(feature => polygonsOf(feature.geometry).flatMap(polygon => polygon.slice(1)));
  assert.equal(holes.length, 7);
  assert.equal(manifest.source, 'https://data.humdata.org/dataset/cod-ab-idn');
});

test('projected clipping preserves source properties, holes, islands and RFC 7946 winding', async () => {
  const source = { type: 'FeatureCollection', features: [{
    type: 'Feature', properties: { id: 'test', from: 100, to: 120, sourceName: 'Test kingdom' },
    geometry: { type: 'Polygon', coordinates: [
      [[99, 0], [103, 0], [103, 4], [99, 4], [99, 0]],
      [[100, 1], [100, 2], [101, 2], [101, 1], [100, 1]]
    ] }
  }] };
  let receivedLand;
  const clipped = await clipHistoricalTerritories(source, national, projection, async (territories, land) => {
    receivedLand = land;
    const original = territories.features[0];
    const coordinates = original.geometry.coordinates;
    const clippedCoordinates = coordinates.map(ring => ring.map(([x, y]) => [Math.min(x, projectLonLat(projection, 102, 0).x), y]));
    return { type: 'FeatureCollection', features: [{ ...original, geometry: { type: 'Polygon', coordinates: clippedCoordinates } }] };
  });
  assert.equal(receivedLand.type, 'FeatureCollection');
  const feature = clipped.features[0];
  assert.deepEqual(feature.properties, source.features[0].properties);
  assert.equal(feature.geometry.coordinates.length, 2);
  assert.ok(signedArea(feature.geometry.coordinates[0]) > 0, 'outer must be counter-clockwise');
  assert.ok(signedArea(feature.geometry.coordinates[1]) < 0, 'hole must be clockwise');
  assert.deepEqual(feature.geometry.coordinates[0][0], feature.geometry.coordinates[0].at(-1));
  const projected = projectLonLat(projection, 101, 1);
  const { x, y } = projected;
  const roundtrip = unprojectToLonLat(projection, x, y);
  assert.ok(Math.abs(roundtrip.lon - 101) < 1e-10);
  assert.ok(Math.abs(roundtrip.lat - 1) < 1e-10);
});

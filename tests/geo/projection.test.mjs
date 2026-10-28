import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { projectLonLat, unprojectToLonLat } from '../../src/lib/map/projection.ts';
import { projectLonLat as projectThreeVector } from '../../src/lib/map/geometry.ts';

const projection = { scale: 286, translate: [500, 250] };

test('pure Mercator projection preserves the geographic package formula and round-trips coordinates', () => {
  const places = [
    { lon: 106.8272, lat: -6.1751 },
    { lon: 95.3, lat: 5.55 },
    { lon: 140.7, lat: -9.4 }
  ];
  for (const place of places) {
    const point = projectLonLat(projection, place.lon, place.lat);
    const vector = projectThreeVector(projection, place.lon, place.lat);
    assert.equal(point.x, vector.x);
    assert.equal(point.y, vector.y);
    const inverse = unprojectToLonLat(projection, point.x, point.y);
    assert.ok(Math.abs(inverse.lon - place.lon) < 1e-10);
    assert.ok(Math.abs(inverse.lat - place.lat) < 1e-10);
  }
});

test('the pure projection module does not import a graphics engine', async () => {
  const source = await readFile(new URL('../../src/lib/map/projection.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]three(?:\/|['"])/);
});

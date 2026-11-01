import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { clipHistoricalTerritories, nationalLandGeoJson, intersectProjectedTerritories as intersect } from '../../scripts/geo/history-land-mask.mjs';
import { projectLonLat, unprojectToLonLat } from '../../src/lib/map/projection.ts';

const load = name => JSON.parse(readFileSync(new URL(`../../static/data/${name}`, import.meta.url)));
const national = load('geometry-2025/national.json');
const raw = load('history-territories.geojson');
const rendered = load('history-territories-render.geojson');

function polygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return geometry.coordinates;
}

test('real planar intersection retains islands and a land-mask lake hole in the same coordinate space', async () => {
  const projection = { scale: 180 / Math.PI, translate: [0, 0] };
  const mask = { regions: [{ path: 'M0,0L10,0L10,10L0,10ZM2,2L2,4L4,4L4,2ZM20,0L24,0L24,4L20,4Z', sourceCode: 'test', name: 'Mask' }] };
  const source = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'test', from: 100, to: 200, sourceName: 'Source' }, geometry: { type: 'MultiPolygon', coordinates: [
    [[[-1, 1], [12, 1], [12, -12], [-1, -12], [-1, 1]]],
    [[[19, 1], [25, 1], [25, -5], [19, -5], [19, 1]]]
  ] } }] };
  const result = await clipHistoricalTerritories(source, mask, projection, intersect);
  assert.equal(result.features.length, 1);
  assert.deepEqual(result.features[0].properties, source.features[0].properties);
  const parts = polygons(result.features[0].geometry);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map(part => part.length).sort(), [1, 2]);
  const points = parts.flat(2).map(([lon, lat]) => projectLonLat(projection, lon, lat));
  for (const [x, y] of [[0, 0], [10, 10], [2, 2], [4, 4], [20, 0], [24, 4]]) {
    assert.ok(points.some(point => Math.abs(point.x - x) < 1e-7 && Math.abs(point.y - y) < 1e-7), `missing canonical vertex ${x},${y}`);
  }
});

test('dissolving the modern land mask creates no internal province frontier', async () => {
  const projection = { scale: 180 / Math.PI, translate: [0, 0] };
  const mask = { regions: [
    { path: 'M0,0L5,0L5,10L0,10Z', sourceCode: 'one', name: 'One' },
    { path: 'M5,0L10,0L10,10L5,10Z', sourceCode: 'two', name: 'Two' }
  ] };
  const source = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'whole' }, geometry: { type: 'Polygon', coordinates: [[[-1, 1], [12, 1], [12, -12], [-1, -12], [-1, 1]]] } }] };
  const result = await clipHistoricalTerritories(source, mask, projection, intersect);
  assert.equal(result.features.length, 1);
  assert.equal(polygons(result.features[0].geometry).length, 1);
  for (const polygon of polygons(result.features[0].geometry)) for (const ring of polygon) {
    for (let index = 1; index < ring.length; index++) {
      const start = projectLonLat(projection, ...ring[index - 1]);
      const end = projectLonLat(projection, ...ring[index]);
      assert.ok(!(Math.abs(start.x - 5) < 1e-7 && Math.abs(end.x - 5) < 1e-7 && Math.abs(start.y - end.y) > 1e-7));
    }
  }
});

test('independent original-SVG checks reject offshore boundaries and filled lakes across the complete render artifact', () => {
  const process = spawnSync('node', ['scripts/geo/verify-history-svg.mjs'], { encoding: 'utf8' });
  assert.equal(process.status, 0, process.stderr + process.stdout);
  const result = JSON.parse(process.stdout);
  assert.equal(result.outsideEdgeIntervals, 0);
  assert.equal(result.filledHoleCount, 0);
  assert.equal(result.positiveInteriorFeatures, rendered.features.length);
  assert.ok(result.checkedIntervals > 200000);
  assert.ok(result.frozenOutsideWitnesses.every(witness => !witness.coveredByRender && !witness.insideOriginalSvg));
});

for (const fixture of [
  { name: 'offshore square', point: [0, 0] },
  { name: 'filled original lake', point: [278.5865122340423, 335.5566] }
]) {
  test(`independent SVG oracle rejects an intentionally ${fixture.name}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'history-land-negative-'));
    try {
      const [x, y] = fixture.point;
      const ring = [[x - .01, y - .01], [x + .01, y - .01], [x + .01, y + .01], [x - .01, y + .01], [x - .01, y - .01]].map(([px, py]) => {
        const point = unprojectToLonLat(national.projection, px, py);
        return [point.lon, point.lat];
      });
      const path = join(directory, 'invalid.geojson');
      writeFileSync(path, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'invalid' }, geometry: { type: 'Polygon', coordinates: [ring] } }] }));
      const process = spawnSync('node', ['scripts/geo/verify-history-svg.mjs', path, 'static/data/geometry-2025/national.json', '1'], { encoding: 'utf8' });
      assert.equal(process.status, 1, process.stderr + process.stdout);
      assert.ok(JSON.parse(process.stdout).failureCount > 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

for (const periods of [
  { target: ['sunda', 732], other: ['tarumanagara', 367] },
  { target: ['sunda', 674], other: ['sunda', 732] },
  { target: ['dutch-east-indies', 1908], other: ['dutch-east-indies', 1800] }
]) {
  test(`${periods.target.join(' ')} geometry is independent of overlapping reconstructions from other periods`, async () => {
    const target = raw.features.find(feature => feature.properties.id === periods.target[0] && feature.properties.from === periods.target[1]);
    const other = raw.features.find(feature => feature.properties.id === periods.other[0] && feature.properties.from === periods.other[1]);
    assert.ok(target && other);
    const isolated = await clipHistoricalTerritories({ type: 'FeatureCollection', features: [target] }, national, national.projection, intersect);
    const together = await clipHistoricalTerritories({ type: 'FeatureCollection', features: [other, target] }, national, national.projection, intersect);
    assert.equal(isolated.features.length, 1);
    const matched = together.features.find(feature => feature.properties.id === target.properties.id && feature.properties.from === target.properties.from);
    assert.deepEqual(matched.geometry, isolated.features[0].geometry);
  });
}

test('render artifact retains dated source identity and pins the exact base geometry', () => {
  const bytes = readFileSync(new URL('../../static/data/geometry-2025/national.json', import.meta.url));
  assert.equal(rendered.metadata.land_mask_sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(rendered.metadata.source_feature_count, raw.features.length);
  const legacyFeatures = rendered.features.filter(feature => !feature.properties.modern);
  assert.equal(legacyFeatures.length, rendered.metadata.clipped_feature_count);
  assert.equal(rendered.features.length, rendered.metadata.rendered_feature_count);
  for (const feature of legacyFeatures) assert.ok(raw.features.some(source => JSON.stringify(source.properties) === JSON.stringify(feature.properties)));
  assert.equal(nationalLandGeoJson(national).features.length, 38);
});

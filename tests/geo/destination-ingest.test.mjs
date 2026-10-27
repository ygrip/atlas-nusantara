import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../../scripts/destinations/ingest.mjs';
import { validateDestinationCatalog } from '../../src/lib/data/destination-contract.ts';
import { validateDestinationIndex } from '../../src/lib/data/destination-index.ts';

const codes = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];
const rectangle = (left, bottom, right, top) => `M${left},${bottom}L${right},${bottom}L${right},${top}L${left},${top}Z`;
const geometry = {
  codeEdition: 'Kepmendagri 300.2.2-2430/2025', level: 'province', projection: { type: 'mercator', scale: 1, translate: [0, 0] },
  regions: codes.map((sourceCode, index) => ({ sourceCode, path: index === 0 ? rectangle(-0.1, -0.1, 0.1, 0.1) : rectangle(index * 2, -0.1, index * 2 + 0.1, 0.1) }))
};
const manifest = { source: 'Example OSM extract', sourceUrl: 'https://example.org/data', license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', retrievedAt: '2025-04-01T00:00:00Z' };
const feature = (id, category = 'natural') => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { id, name: 'Example ' + id, category } });

test('builds deterministic licensed records into all 38 lazy province shards', () => {
  const features = [feature('cultural-place', 'cultural'), feature('nature-place')];
  const first = buildCatalog(features, manifest, geometry);
  const second = buildCatalog(features, manifest, geometry);
  assert.deepEqual(first, second);
  assert.equal(validateDestinationIndex(first.index), true);
  for (const shard of Object.values(first.shards)) assert.equal(validateDestinationCatalog(shard), true);
  assert.equal(first.index.schemaVersion, 2);
  assert.equal(first.index.provinces.length, 38);
  assert.equal(first.index.provinces.find(item => item.provinceCode === '11').natural, 1);
  assert.equal(first.index.coverage.totalRecords, 2);
  assert.equal(first.index.coverage.sourceCoveragePercent, null);
  assert.equal(first.shards['11'].landmarks[0].provinceCode, '11');
  assert.equal(first.shards['11'].landmarks.find(item => item.officialId === 'cultural-place').subtype, 'cultural');
  assert.equal(first.shards['11'].landmarks.find(item => item.officialId === 'cultural-place').kind, 'built');
  assert.equal(first.shards['12'].landmarks.length, 0);
});

test('fails closed for unapproved licenses, duplicate IDs, missing categories, and unjoined coordinates', () => {
  assert.throws(() => buildCatalog([feature('a')], { ...manifest, license: 'UNKNOWN' }, geometry), /Unsupported license/);
  assert.throws(() => buildCatalog([feature('a'), feature('a')], manifest, geometry), /Duplicate source identifier/);
  assert.throws(() => buildCatalog([feature('a', '')], manifest, geometry), /Unsupported or missing category/);
  const outsideGeometry = { ...geometry, regions: geometry.regions.map((region, index) => ({ ...region, path: rectangle(index * 2 + 100, 0, index * 2 + 100.1, 0.1) })) };
  assert.throws(() => buildCatalog([feature('a')], manifest, outsideGeometry), /matched 0/);
});

test('requires explicit reviewed image metadata and rejects guessed province assignments', () => {
  const withImage = feature('image');
  withImage.properties.image = { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', credit: 'Photographer', license: 'CC-BY-4.0', reviewedAt: '2025-04-02T00:00:00Z' };
  assert.throws(() => buildCatalog([withImage], manifest, geometry), /Image metadata must be reviewed/);
  withImage.properties.imageReviewed = true;
  assert.equal(buildCatalog([withImage], manifest, geometry).shards['11'].landmarks[0].image.license, 'CC-BY-4.0');
  withImage.properties.image.url = 'https://example.org/image.jpg';
  assert.throws(() => buildCatalog([withImage], manifest, geometry), /Wikimedia Commons Special:FilePath/);
  assert.throws(() => buildCatalog([feature('bad-point')], { ...manifest, retrievedAt: 'yesterday' }, geometry), /ISO UTC timestamp/);
});

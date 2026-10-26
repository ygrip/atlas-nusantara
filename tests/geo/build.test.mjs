import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildGeometry, CODE_EDITION } from '../../scripts/geo/build-geometry.mjs';

// Synthetic rectangles exercise projection and partitioning, never production geography.
function fixtureFeature(region, index) {
  const x = 95 + index * .01;
  return { type: 'Feature', properties: { code: region.code }, geometry: { type: 'Polygon', coordinates: [[[x, -5], [x + .005, -5], [x + .005, -4.995], [x, -4.995], [x, -5]]] } };
}

test('builds national and one province as Git-ready SVG/JSON, without generating other provinces', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nusantara-geometry-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const adminDirectory = new URL('../../static/data/admin-2022/', import.meta.url).pathname;
  const provinces = JSON.parse(await readFile(join(adminDirectory, 'provinces.json'), 'utf8')).regions;
  const cities = JSON.parse(await readFile(join(adminDirectory, 'cities.json'), 'utf8')).regions.filter(region => region.parentCode === '11');
  const provinceBytes = JSON.stringify({ type: 'FeatureCollection', features: provinces.map(fixtureFeature) });
  const cityBytes = JSON.stringify({ type: 'FeatureCollection', features: cities.map(fixtureFeature) });
  const inputDirectory = join(directory, 'cities');
  await mkdir(inputDirectory);
  await writeFile(join(directory, 'provinces.geojson'), provinceBytes);
  await writeFile(join(inputDirectory, '11.geojson'), cityBytes);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const provenance = { boundaryEdition: 'SYNTHETIC TEST FIXTURE', codeEdition: CODE_EDITION, source: 'https://example.org/test-fixture', license: 'CC0-1.0', licenseUrl: 'https://example.org/fixture-license', reviewedBy: 'Test only', reviewedAt: '2026-01-01', provinceSha256: hash(provinceBytes), citySha256: { '11': hash(cityBytes) } };
  await writeFile(join(directory, 'provenance.json'), JSON.stringify(provenance));
  const outputDirectory = join(directory, 'output');
  const options = { provinceInput: join(directory, 'provinces.geojson'), cityInput: inputDirectory, provenanceInput: join(directory, 'provenance.json'), outputDirectory, adminDirectory, selectedProvince: '11' };
  await buildGeometry(options);
  const national = JSON.parse(await readFile(join(outputDirectory, 'national.json'), 'utf8'));
  const province = JSON.parse(await readFile(join(outputDirectory, 'provinces/11.json'), 'utf8'));
  assert.equal(national.regions.length, 37);
  assert.equal(province.regions.length, cities.length);
  assert.ok(province.regions.every(region => region.path && !region.path.includes('NaN') && region.bbox.every(Number.isFinite)));
  assert.match(await readFile(join(outputDirectory, 'provinces/11.svg'), 'utf8'), /<metadata>.*SYNTHETIC TEST FIXTURE/);
  await assert.rejects(access(join(outputDirectory, 'provinces/12.svg')));
  await assert.rejects(buildGeometry({ ...options, selectedProvince: '99' }), /Unknown province/);
  const beforeFailure = await readFile(join(outputDirectory, 'national.svg'), 'utf8');
  await writeFile(join(inputDirectory, '11.geojson'), '{}');
  await assert.rejects(buildGeometry(options), /checksum mismatch/);
  assert.equal(await readFile(join(outputDirectory, 'national.svg'), 'utf8'), beforeFailure);
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory, 'provinces/11.json'), 'utf8')), province);
});

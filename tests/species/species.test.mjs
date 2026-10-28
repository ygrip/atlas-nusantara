import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isSpeciesCatalog, isSpeciesIndex, isSpeciesRecord } from '../../src/lib/data/species-validation.js';
import { filterSpecies, sortSpecies } from '../../src/lib/data/species-table.ts';

const KINDS = ['flora', 'fauna'];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const sample = {
  id: '5219404', scientificName: 'Panthera tigris', name: 'Harimau', nameEn: 'Tiger', group: 'mammals', family: 'Felidae', status: 'EN',
  realms: ['terrestrial'], habitat: '', summary: '', provinces: ['11'], sources: ['gbif'], protected: true
};

test('a minimal species record passes and bad records are rejected', () => {
  assert.equal(isSpeciesRecord(sample), true);
  assert.equal(isSpeciesRecord({ ...sample, status: 'ZZ' }), false);
  assert.equal(isSpeciesRecord({ ...sample, group: 'dragons' }), false);
  assert.equal(isSpeciesRecord({ ...sample, provinces: ['99'] }), false);
  assert.equal(isSpeciesRecord({ ...sample, provinces: ['11', '11'] }), false);
  assert.equal(isSpeciesRecord({ ...sample, summary: 'text' }), false, 'a summary needs its language');
  assert.equal(isSpeciesRecord({ ...sample, images: [{ id: 1, ext: 'exe', credit: 'A', license: '' }] }), false);
  assert.equal(isSpeciesRecord({ ...sample, images: [{ id: 1, ext: 'jpg', credit: 'A', license: 'cc-by' }] }), true);
  assert.equal(isSpeciesRecord({ ...sample, images: [] }), false);
});

test('a province catalog only holds species recorded in that province', () => {
  const catalog = { schemaVersion: 1, kind: 'fauna', fetchedAt: '2026-01-01T00:00:00Z', provinceCode: '11', species: [sample] };
  assert.equal(isSpeciesCatalog(catalog, 'fauna'), true);
  assert.equal(isSpeciesCatalog(catalog, 'flora'), false);
  assert.equal(isSpeciesCatalog({ ...catalog, provinceCode: '12' }, 'fauna'), false);
  assert.equal(isSpeciesCatalog({ ...catalog, species: [sample, sample] }, 'fauna'), false);
});

test('filters search every name, and sorting keeps the worst status first', () => {
  const frog = { ...sample, id: '2', scientificName: 'Rana test', name: '', nameEn: 'Test frog', group: 'amphibians', status: 'LC', protected: undefined, aliases: ['Kodok'] };
  const records = [frog, sample];
  assert.deepEqual(filterSpecies(records, { query: 'harimau' }).map(item => item.id), ['5219404']);
  assert.deepEqual(filterSpecies(records, { query: 'kodok' }).map(item => item.id), ['2']);
  assert.deepEqual(filterSpecies(records, { group: 'amphibians' }).map(item => item.id), ['2']);
  assert.deepEqual(filterSpecies(records, { protection: 'protected' }).map(item => item.id), ['5219404']);
  assert.deepEqual(sortSpecies(records, 'status', 'ascending', 'en').map(item => item.id), ['5219404', '2']);
});

for (const kind of KINDS) {
  test(`${kind}: published index, 38 province shards and the national file agree`, async () => {
    const index = await readJson(`static/data/${kind}/index.json`);
    assert.equal(isSpeciesIndex(index, kind), true);
    const national = await readJson(`static/data/${kind}/national.json`);
    assert.equal(isSpeciesCatalog(national, kind), true);
    assert.equal(national.species.length, index.coverage.totalSpecies);
    let withoutProvince = 0;
    for (const record of national.species) if (record.provinces.length === 0) withoutProvince++;
    assert.equal(withoutProvince, index.coverage.withoutProvince);
    for (const summary of index.provinces) {
      const shard = await readJson(`static/data/${kind}/provinces/${summary.provinceCode}.json`);
      assert.equal(isSpeciesCatalog(shard, kind), true, summary.provinceCode);
      assert.equal(shard.species.length, summary.count, 'count ' + summary.provinceCode);
      assert.equal(shard.species.filter(item => ['CR', 'EN', 'VU'].includes(item.status)).length, summary.threatened);
      assert.equal(shard.species.filter(item => item.images).length, summary.withImage);
    }
  });
}

test('the Papua provinces each hold their own species instead of one shared list', async () => {
  const index = await readJson('static/data/fauna/index.json');
  const counts = new Map(index.provinces.map(item => [item.provinceCode, item.count]));
  for (const code of ['91', '92', '93', '94', '95', '96']) assert.ok(counts.get(code) > 0, 'province ' + code);
  assert.ok(new Set(['91', '92', '93', '94', '95', '96'].map(code => counts.get(code))).size > 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeDestinationCatalog, rebuildStaticDestinations } from '../../scripts/destinations/catalog-output.mjs';

const codes = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];
const fetchedAt = '2026-10-27T00:00:00Z';
const image = { url: 'https://upload.wikimedia.org/example.jpg', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', credit: 'Example photographer', license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', reviewedAt: fetchedAt };

function makeCatalog() {
  const shards = Object.fromEntries(codes.map(code => [code, {
    schemaVersion: 1, codeEdition: 'edition-2025', provinceCode: code,
    source: 'SISPARNAS', sourceUrl: 'https://example.org/source', license: 'source terms unverified',
    attribution: 'Government source', retrievedAt: fetchedAt, fetchedAt, scope: 'source records', landmarks: []
  }]));
  shards['12'].landmarks.push({ id: 'place-b', officialId: '2', provinceCode: '12', name: 'Second', kind: 'unknown', sourceUrl: 'https://example.org/2', image: structuredClone(image), provenanceUrl: 'https://example.org/proof', retrievedAt: fetchedAt });
  shards['11'].landmarks.push({ id: 'place-a', officialId: '1', provinceCode: '11', name: 'First', kind: 'natural', sourceUrl: 'https://example.org/1' });
  const provinces = codes.map(provinceCode => {
    const landmarks = shards[provinceCode].landmarks;
    return { provinceCode, count: landmarks.length, natural: landmarks.filter(item => item.kind === 'natural').length,
      built: landmarks.filter(item => item.kind === 'built').length,
      unknown: landmarks.filter(item => item.kind === 'unknown').length,
      shard: `/data/destinations/provinces/${provinceCode}.json` };
  });
  return { index: { schemaVersion: 2, fetchedAt, source: 'SISPARNAS', sourceUrl: 'https://example.org/source',
    license: 'terms unverified', attribution: 'Government source', scope: 'source records', sourceLicense: null,
    coverage: { totalRecords: 2, geocodedRecords: 0, classifiedRecords: 1, licensedImages: 1, sourceCoveragePercent: null }, provinces }, shards };
}

async function inTempDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'national-destinations-'));
  try { await run(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('writes sorted national aggregate and compact index while preserving complete photo evidence', async () => {
  await inTempDirectory(async directory => {
    const { index, shards } = makeCatalog();
    const { national, index: publishedIndex } = await writeDestinationCatalog(directory, index, shards);
    assert.equal(publishedIndex.national, '/data/destinations/national.json');
    assert.equal(national.countryCode, 'ID');
    assert.deepEqual(national.landmarks.map(place => place.id), ['place-a', 'place-b']);
    assert.deepEqual(national.landmarks[1], shards['12'].landmarks[0]);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'national.json'), 'utf8')), national);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'index.json'), 'utf8')).coverage.totalRecords, 2);
  });
});

test('writes deterministic aggregate and shard bytes for unchanged input', async () => {
  await inTempDirectory(async directory => {
    const first = makeCatalog();
    await writeDestinationCatalog(directory, first.index, first.shards);
    const initial = await readFile(path.join(directory, 'national.json'), 'utf8');
    const second = makeCatalog();
    await writeDestinationCatalog(directory, second.index, second.shards);
    assert.equal(await readFile(path.join(directory, 'national.json'), 'utf8'), initial);
    for (const code of codes) {
      assert.deepEqual(await readFile(path.join(directory, 'provinces', code + '.json')), Buffer.from(JSON.stringify(second.shards[code]) + '\n'));
    }
  });
});

test('manual updates rebuild summaries and national JSON without network requests', async () => {
  await inTempDirectory(async directory => {
    const { index, shards } = makeCatalog();
    await writeDestinationCatalog(directory, index, shards);
    shards['11'].landmarks.push({ id: 'new-manual-place', provinceCode: '11', name: 'Manual addition', kind: 'unknown' });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(directory, 'provinces/11.json'), JSON.stringify(shards['11']));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw Error('Manual update must not make network requests'); };
    try {
      const result = await rebuildStaticDestinations(directory);
      assert.equal(result.records, 3);
      const updated = JSON.parse(await readFile(path.join(directory, 'index.json'), 'utf8'));
      assert.equal(updated.provinces.find(item => item.provinceCode === '11').count, 2);
      assert.equal(updated.coverage.totalRecords, 3);
      assert.equal(updated.fetchedAt, fetchedAt);
      assert.equal(JSON.parse(await readFile(path.join(directory, 'national.json'), 'utf8')).landmarks.length, 3);
    } finally { globalThis.fetch = originalFetch; }
  });
});

for (const [name, change] of [
  ['empty destination name', place => { place.name = ''; }],
  ['non-numeric coordinates', place => { place.lat = 'bad'; place.lon = 110; }],
  ['unsafe source URL', place => { place.sourceUrl = 'javascript:alert(1)'; }],
  ['invalid district type', place => { place.sourceDistrict = 123; }]
]) {
  test(`manual writer rejects ${name} before publishing files`, async () => {
    await inTempDirectory(async directory => {
      const { index, shards } = makeCatalog();
      change(shards['11'].landmarks[0]);
      await assert.rejects(writeDestinationCatalog(directory, index, shards), /Invalid province destination data/);
      await assert.rejects(readFile(path.join(directory, 'index.json')), { code: 'ENOENT' });
    });
  });
}

test('rejects duplicate identifiers, cross-province records, and summary/count mismatches', async () => {
  await inTempDirectory(async directory => {
    const duplicate = makeCatalog();
    duplicate.shards['12'].landmarks[0].id = duplicate.shards['11'].landmarks[0].id;
    await assert.rejects(writeDestinationCatalog(directory, duplicate.index, duplicate.shards), /duplicate national destination ID/i);

    const misplaced = makeCatalog();
    misplaced.shards['12'].landmarks[0].provinceCode = '11';
    await assert.rejects(writeDestinationCatalog(directory, misplaced.index, misplaced.shards), /different province/i);

    const mismatch = makeCatalog();
    mismatch.index.coverage.totalRecords = 3;
    await assert.rejects(writeDestinationCatalog(directory, mismatch.index, mismatch.shards), /contract|total disagrees/i);
  });
});

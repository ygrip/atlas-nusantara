import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSisparnas, buildSisparnasCatalog } from '../../scripts/destinations/build-sisparnas.mjs';
import { validateDestinationIndex } from '../../src/lib/data/destination-index.ts';
import { validateDestinationCatalog } from '../../src/lib/data/destination-contract.ts';

const admin = JSON.parse(readFileSync(new URL('../../static/data/admin-2025/provinces.json', import.meta.url), 'utf8'));
const geometry = JSON.parse(readFileSync(new URL('../../static/data/geometry-2025/national.json', import.meta.url), 'utf8'));
const raw = { provinceOptions: 38, districtsAttempted: 3, uniqueIds: 3,
  nationalAggregateReported: 4, sumExpectedByDistrict: 4, partialCountMismatches: 1,
  categoryFilters: [], mismatches: [], factualRecords: [
    { id: '1', provId: '11', province: 'Aceh', districtId: '1101', district: 'Kabupaten Simeulue', name: 'Source record', lat: '2.505146', lng: '96.194334' },
    { id: '2', provId: '91', province: 'Papua Barat', districtId: '9101', district: 'Source district', name: 'Invalid point', lat: '999', lng: '0' },
    { id: '3', provId: '92', province: 'Papua', districtId: '9201', district: 'Source district', name: 'Missing point', lat: '', lng: '' }
  ] };

test('keeps every source record without inventing categories or trusting swapped Papua IDs', () => {
  const built = buildSisparnasCatalog(raw, admin, geometry, '2026-10-27T00:00:00Z');
  assert.equal(validateDestinationIndex(built.index), true);
  assert.equal(built.index.coverage.totalRecords, 3);
  assert.equal(built.index.coverage.classifiedRecords, 0);
  assert.equal(built.index.coverage.sourceCoveragePercent, null);
  assert.equal(built.quarantine.length, 0);
  assert.equal(built.shards['92'].landmarks[0].officialId, '2');
  assert.equal(built.shards['91'].landmarks[0].officialId, '3');
  assert.equal(built.shards['92'].landmarks[0].lon, undefined);
  assert.equal(built.shards['11'].landmarks[0].kind, 'unknown');
  assert.equal(built.shards['11'].landmarks[0].sourceDistrictId, '1101');
  for (const shard of Object.values(built.shards)) assert.equal(validateDestinationCatalog(shard), true);
});

test('normalization preserves response timestamps and does not invent them for recovered output', () => {
  const value = structuredClone(raw);
  value.factualRecords[0].retrievedAt = '2026-10-26T22:15:00Z';
  const normalized = normalizeSisparnas(value, '2026-10-27T00:00:00Z');
  assert.equal(normalized.records[0].retrievedAt, '2026-10-26T22:15:00Z');
  const recovered = normalizeSisparnas({ ...raw, timestampBasis: 'recovered-output' }, '2026-10-27T00:00:00Z');
  assert.equal(recovered.records[0].retrievedAt, undefined);
  assert.deepEqual(normalizeSisparnas(value, '2026-10-27T00:00:00Z'), normalized);
});

for (const [name, mutate] of [
  ['duplicate IDs', value => { value.factualRecords[1].id = '1'; }],
  ['missing source records', value => { value.factualRecords.pop(); }],
  ['invalid source ID', value => { value.factualRecords[0].id = '../bad'; }]
]) {
  test(`rejects ${name}`, () => {
    const value = structuredClone(raw);
    mutate(value);
    assert.throws(() => normalizeSisparnas(value, '2026-10-27T00:00:00Z'));
  });
}

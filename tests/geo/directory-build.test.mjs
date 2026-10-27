import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDirectoryCatalog } from '../../scripts/destinations/build-directory.mjs';
import { validateDestinationCatalog } from '../../src/lib/data/destination-contract.ts';
import { validateDestinationIndex } from '../../src/lib/data/destination-index.ts';

const codes = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];
const names = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung','Kepulauan Bangka Belitung','Kepulauan Riau','Daerah Khusus Ibukota Jakarta','Jawa Barat','Jawa Tengah','Daerah Istimewa Yogyakarta','Jawa Timur','Banten','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan','Sulawesi Tenggara','Gorontalo','Sulawesi Barat','Maluku','Maluku Utara','Papua','Papua Barat','Papua Selatan','Papua Tengah','Papua Pegunungan','Papua Barat Daya'];
const admin = { edition: 'Kepmendagri 300.2.2-2430/2025', count: 38,
  regions: codes.map((code, index) => ({ code, name: names[index], level: 'province' })) };
const projection = { type: 'mercator', scale: 1, translate: [0, 0] };
const ring = index => {
  const left = (index * 2 + 0.1) * Math.PI / 180;
  const right = (index * 2 + 0.9) * Math.PI / 180;
  return `M${left},-0.01L${right},-0.01L${right},0.01L${left},0.01Z`;
};
const geometry = { codeEdition: admin.edition, level: 'province', projection,
  regions: codes.map((sourceCode, index) => ({ sourceCode, path: ring(index) })) };
const pointFor = code => {
  const index = codes.indexOf(code);
  return { lon: index * 2 + 0.5, lat: 0 };
};
const inventory = records => ({ source: 'Direktori Pariwisata', sourceUrl: 'https://www.direktoripariwisata.id/browse?cat=0',
  expectedRecords: 8383, complete: false, fetchedAt: '2026-10-27T00:00:00Z', records });
const record = (officialId, sourceProvince, sourceCategory = 1, extra = {}) => ({
  officialId, name: 'Destination ' + officialId, sourceCategory, sourceProvince,
  sourceUrl: 'https://www.direktoripariwisata.id/unit/' + officialId,
  provenanceUrl: 'https://www.direktoripariwisata.id/unit/' + officialId,
  retrievedAt: '2026-10-27T00:00:00Z', ...extra
});

 test('builds source-linked 38-province summaries and per-province runtime-compatible shards', () => {
  const places = [record('1', 'Jawa Timur', 1, pointFor('35')),
    record('2', 'DKI Jakarta', 2, pointFor('31')),
    record('3', 'DI Yogyakarta', 3, pointFor('34'))];
  const result = buildDirectoryCatalog(inventory(places), admin, geometry);
  assert.equal(validateDestinationIndex(result.index), true);
  assert.equal(result.index.provinces.length, 38);
  assert.equal(result.index.coverage.totalRecords, 3);
  assert.equal(result.index.coverage.sourceCoveragePercent, null);
  assert.equal(result.index.sourceLicense, null);
  assert.match(result.index.license, /reuse terms unspecified/);
  assert.equal(result.index.license.includes('CC-BY'), false);
  for (const shard of Object.values(result.shards)) assert.equal(validateDestinationCatalog(shard), true);
  assert.equal(result.shards['35'].landmarks[0].id, 'directory-1');
  assert.equal(result.shards['31'].landmarks[0].provinceCode, '31');
  assert.equal(result.shards['34'].landmarks[0].subtype, 'cultural');
  assert.equal(result.shards['32'].landmarks.length, 0);
  assert.equal(result.report.sourceCoveragePercent, null);
});

test('maps legacy Papua records by pinned geometry, never by the ambiguous old label', () => {
  const papuaSouth = record('papua-south', 'Papua', 1, pointFor('93'));
  const noPoint = record('papua-unknown', 'Papua Barat', 1);
  const result = buildDirectoryCatalog(inventory([papuaSouth, noPoint]), admin, geometry);
  assert.equal(result.shards['93'].landmarks[0].officialId, 'papua-south');
  assert.equal(result.shards['91'].landmarks.length, 0);
  assert.ok(result.quarantine.some(item => item.officialId === 'papua-unknown'
    && item.reason === 'legacy-papua-requires-verified-coordinates'));
});

test('quarantines unknown classes and non-exact province matches without making up records', () => {
  const places = [record('uncategorized', 'Aceh', null, pointFor('11')),
    record('unknown-province', 'Kota Fiksi', 1, pointFor('11'))];
  const result = buildDirectoryCatalog(inventory(places), admin, geometry);
  assert.equal(result.index.coverage.totalRecords, 0);
  assert.equal(result.report.quarantinedRecords, 2);
  assert.deepEqual(result.quarantine.map(item => item.reason).sort(), ['unknown-category', 'unknown-source-province']);
});

test('omits out-of-province coordinates but preserves independently named province assignment', () => {
  const result = buildDirectoryCatalog(inventory([record('wrong-coordinate', 'Aceh', 1, pointFor('32'))]), admin, geometry);
  const place = result.shards['11'].landmarks[0];
  assert.equal(place.provinceCode, '11');
  assert.equal(place.lon, undefined);
  assert.equal(place.lat, undefined);
  assert.equal(place.coordinateStatus, 'omitted-source-coordinate-outside-named-province');
  assert.equal(result.index.coverage.geocodedRecords, 0);
});

test('preserves source category distinctions and only claims measured complete coverage', () => {
  const places = [record('park', 'Jawa Timur', 4, pointFor('35')),
    record('culture', 'Jawa Timur', 3, pointFor('35'))];
  const completeInventory = { ...inventory(places), complete: true, expectedRecords: 2 };
  const result = buildDirectoryCatalog(completeInventory, admin, geometry);
  assert.equal(result.index.coverage.sourceCoveragePercent, 100);
  assert.equal(result.shards['35'].landmarks.find(place => place.officialId === 'park').sourceCategory, 4);
  assert.equal(result.shards['35'].landmarks.find(place => place.officialId === 'culture').subtype, 'cultural');
});

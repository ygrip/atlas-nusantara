import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptBmkgEarthquakes, adaptCanonicalFeed } from '../../src/lib/data/ingestion/adapters.ts';
import { makeSnapshot } from '../../src/lib/data/ingestion/schema.ts';

const provenance = {
  source: 'BMKG', sourceUrl: 'https://data.bmkg.go.id/', sourcePublishedAt: null,
  fetchedAt: '2026-01-01T00:00:00Z', validUntil: null, license: 'Public-Domain',
  licenseUrl: 'https://data.bmkg.go.id/gempabumi/', reviewedBy: 'Data review', reviewedAt: '2026-01-01T00:00:00Z',
  coverage: ['Indonesia'], edition: null
};
const options = { provenance, generatedAt: '2026-01-01T00:01:00Z', regions: { has: (code: string) => code === '31.01' } };
const bmkgRow = { DateTime: '2026-10-22T10:57:49+00:00', Tanggal: '22 Okt 2026', Jam: '17:57:49 WIB', Coordinates: '-3.11,102.14', Magnitude: '5.2', Kedalaman: '120 km', Wilayah: 'Bengkulu', Potensi: 'Tidak berpotensi tsunami' };

test('BMKG feed array prefers ISO DateTime and becomes an observation point', () => {
  const snapshot = adaptBmkgEarthquakes({ Infogempa: { gempa: [bmkgRow] } }, options);
  assert.equal(snapshot.records[0].type, 'earthquake');
  assert.deepEqual(snapshot.records[0].geometry, { type: 'Point', coordinates: [102.14, -3.11] });
  assert.equal(snapshot.records[0].properties.magnitude, 5.2);
  assert.equal(snapshot.records[0].observedAt, '2026-10-22T10:57:49.000Z');
  assert.deepEqual(snapshot.records[0].regionCodes, []);
  assert.deepEqual(snapshot.records[0].unmatchedRegionCodes, []);
});

test('BMKG single-event object and Indonesian date/time fallback honor WITA and WIT', () => {
  const wita = adaptBmkgEarthquakes({ Infogempa: { gempa: { ...bmkgRow, DateTime: undefined, Tanggal: '22 Okt 2026', Jam: '18:57:49 WITA' } } }, options);
  const wit = adaptBmkgEarthquakes({ Infogempa: { gempa: { ...bmkgRow, DateTime: undefined, Tanggal: '22 Okt 2026', Jam: '19:57:49 WIT' } } }, options);
  assert.equal(wita.records[0].observedAt, '2026-10-22T10:57:49.000Z');
  assert.equal(wit.records[0].observedAt, '2026-10-22T10:57:49.000Z');
  assert.throws(() => adaptBmkgEarthquakes({ Infogempa: { gempa: { ...bmkgRow, DateTime: undefined, Jam: '18:57:49' } } }, options), /include WIB/);
});

test('canonical records preserve exact known and unmatched codes', () => {
  const warningProvenance = { ...provenance, sourcePublishedAt: '2026-01-01T00:00:00Z', validUntil: '2026-01-01T02:00:00Z' };
  const snapshot = adaptCanonicalFeed('warning', { records: [{ id: 'warning-1', type: 'warning', observedAt: null,
    regionCodes: ['31.01', '99.99'], unmatchedRegionCodes: [], geometry: null, properties: { level: 'orange' } }] }, { ...options, provenance: warningProvenance });
  assert.deepEqual(snapshot.records[0].regionCodes, ['31.01']);
  assert.deepEqual(snapshot.records[0].unmatchedRegionCodes, ['99.99']);
});

test('malformed upstream types, dates, numbers, properties and warning validity fail closed', () => {
  assert.throws(() => adaptBmkgEarthquakes({ data: [] }, options), /Infogempa/);
  assert.throws(() => adaptBmkgEarthquakes({ Infogempa: { gempa: [{ ...bmkgRow, DateTime: undefined, Tanggal: '31 Feb 2026' }] } }, options), /invalid/);
  assert.throws(() => adaptBmkgEarthquakes({ Infogempa: { gempa: [{ ...bmkgRow, DateTime: undefined, Jam: '25:57:49 WIB' }] } }, options), /invalid/);
  assert.throws(() => adaptBmkgEarthquakes({ Infogempa: { gempa: [{ ...bmkgRow, Magnitude: ' ' }] } }, options), /Magnitude/);
  assert.throws(() => adaptCanonicalFeed('incident', { records: [{ type: 'alien' }] }, options));
  assert.throws(() => adaptCanonicalFeed('hazard', { records: [{ id: 'bad', type: 'hazard', observedAt: null, regionCodes: [], unmatchedRegionCodes: [], geometry: null, properties: { nested: { x: 1 } } }] }, options));
  assert.doesNotThrow(() => adaptCanonicalFeed('warning', { records: [] }, options));
  assert.throws(() => adaptCanonicalFeed('warning', { records: [{ id: 'alert', type: 'warning', observedAt: null, regionCodes: [], unmatchedRegionCodes: [], geometry: null, properties: {} }] }, options), /validUntil/);
  assert.throws(() => makeSnapshot({ ...provenance, license: 'Terms reviewed, permission unknown' }, [], options.generatedAt), /SPDX/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptBmkgCap } from '../../src/lib/data/ingestion/cap.ts';

const provenance = {
  source: 'BMKG',
  sourceUrl: 'https://www.bmkg.go.id/alerts/nowcast/id/CAP20261026002_alert.xml',
  sourcePublishedAt: null,
  fetchedAt: '2026-10-26T12:00:00Z',
  validUntil: null,
  license: 'Public-Domain',
  licenseUrl: 'https://www.bmkg.go.id/alerts/nowcast/id',
  reviewedBy: 'Fixture reviewer, not production approval',
  reviewedAt: '2026-10-26T10:00:00Z',
  coverage: ['Indonesia'],
  edition: 'CAP 1.2'
};
const options = { provenance, generatedAt: '2026-10-26T12:00:00Z' };
const polygon = '-2.965,119.188 -2.973,119.186 -2.986,119.195 -2.965,119.188';
function xml(overrides: { status?: string; msgType?: string; sender?: string; identifier?: string; expires?: string; effective?: string; areas?: string; namespace?: string } = {}) {
  const identifier = overrides.identifier ?? 'CAP20261026002';
  const areas = overrides.areas ?? `<area><areaDesc>Sulawesi Barat</areaDesc><polygon>${polygon}</polygon><polygon>-3.0,119.0 -3.1,119.0 -3.1,119.1 -3.0,119.0</polygon></area>`;
  return `<alert xmlns="${overrides.namespace ?? 'urn:oasis:names:tc:emergency:cap:1.2'}"><identifier>${identifier}</identifier><sender>${overrides.sender ?? 'cuaca.ekstrem@bmkg.go.id'}</sender><sent>2026-10-26T11:05:00+00:00</sent><status>${overrides.status ?? 'Actual'}</status><msgType>${overrides.msgType ?? 'Alert'}</msgType><scope>Public</scope><info><language>id</language><category>Met</category><event>Hujan Lebat dan Petir</event><effective>${overrides.effective ?? '2026-10-26T19:20:00+08:00'}</effective><expires>${overrides.expires ?? '2026-10-26T21:20:00+08:00'}</expires><senderName>Badan Meteorologi Klimatologi dan Geofisika</senderName><headline>Hujan Lebat di Sulawesi Barat</headline><description>Official warning description.</description><web>https://nowcasting.bmkg.go.id/infografis/test.jpg</web>${areas}</info></alert>`;
}

test('parses actual CAP warning, converts lat/lon polygons and never guesses admin codes', () => {
  const snapshot = adaptBmkgCap(xml(), options);
  const record = snapshot.records[0];
  assert.equal(record.type, 'warning');
  assert.equal(record.id, 'bmkg-cap:CAP20261026002');
  assert.equal(record.observedAt, '2026-10-26T11:05:00+00:00');
  assert.equal(snapshot.provenance.validUntil, '2026-10-26T21:20:00+08:00');
  assert.deepEqual(record.regionCodes, []);
  assert.deepEqual(record.unmatchedRegionCodes, []);
  assert.equal((record.geometry as { type: string }).type, 'MultiPolygon');
  assert.deepEqual((record.geometry as { coordinates: number[][][][] }).coordinates[0][0][0], [119.188, -2.965]);
  assert.equal(record.properties.areaCount, 2);
  assert.equal(record.properties.sourceLink, provenance.sourceUrl);
});

test('preserves multiple CAP areas and polygon rings as separate GeoJSON polygons', () => {
  const source = `<area><areaDesc>First area</areaDesc><polygon>${polygon}</polygon></area><area><areaDesc>Second area</areaDesc><polygon>${polygon}</polygon></area>`;
  const snapshot = adaptBmkgCap(xml({ areas: source }), options);
  assert.equal((snapshot.records[0].geometry as { coordinates: unknown[] }).coordinates.length, 2);
  assert.equal(snapshot.records[0].properties.areaDescriptions, 'First area; Second area');
});

test('rejects non-active or invalid warning dates, sender, namespace and URL', () => {
  assert.throws(() => adaptBmkgCap(xml({ status: 'Test' }), options), /actual/);
  assert.throws(() => adaptBmkgCap(xml({ msgType: 'Cancel' }), options), /original/);
  assert.throws(() => adaptBmkgCap(xml({ sender: 'attacker@example.com' }), options), /sender/);
  assert.throws(() => adaptBmkgCap(xml({ namespace: 'urn:wrong' }), options), /namespace/);
  assert.throws(() => adaptBmkgCap(xml({ expires: '2026-10-26T10:00:00Z' }), options), /Expired|inconsistent/);
  assert.throws(() => adaptBmkgCap(xml({ effective: '2026-10-26T12:30:00Z' }), options), /Future/);
  assert.throws(() => adaptBmkgCap(xml(), { ...options, provenance: { ...provenance, sourceUrl: 'https://www.bmkg.go.id/not-a-warning' } }), /identify an official/);
});

test('rejects XML entities and malformed or unclosed polygon coordinates', () => {
  assert.throws(() => adaptBmkgCap('<!DOCTYPE alert [<!ENTITY x "bad">]>' + xml(), options), /entities are forbidden/);
  assert.throws(() => adaptBmkgCap(xml({ areas: '<area><areaDesc>Bad</areaDesc><polygon>1,2 3,4 5,6 7,8</polygon></area>' }), options), /closed/);
  assert.throws(() => adaptBmkgCap(xml().replace('</alert>', ''), options), /Malformed/);
});

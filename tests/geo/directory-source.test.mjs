import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowsePage, parseDirectoryDetail } from '../../scripts/destinations/directory-source.mjs';

const card = (id, name) => `<a href="../unit/${id}"><img src="../images/wonderful.jpg"><br/>${name}</a>`;
const listing = `<nav>${card(999, 'Navigation')}</nav><div id="numdest">8,383 Destinasi</div>
<div data-tabs-id="cont-a2tabs2" class="container-tabs active">${card(1, 'Bromo')}${card(2, 'Lake &amp; Park')}</div>`;

test('browse parser excludes navigation, reads reported count, and keeps source identifiers', () => {
  const parsed = parseBrowsePage(listing);
  assert.equal(parsed.expectedRecords, 8383);
  assert.deepEqual(parsed.records.map(record => [record.officialId, record.name]), [['1', 'Bromo'], ['2', 'Lake & Park']]);
  assert.equal(parsed.records[0].sourceUrl, 'https://www.direktoripariwisata.id/unit/1');
});

for (const response of ['Selamat datang di Dunia Pariwisata', '<title>404 Not Found</title>', listing.replace('8,383', 'unknown')]) {
  test('non-listing content cannot be mistaken for a complete crawl', () => {
    assert.throws(() => parseBrowsePage(response), /Unrecognized/);
  });
}

test('detail parser joins explicit category membership and source map points without evaluating scripts', () => {
  const detail = `<div class="wrapa_project_fdetails"><h3>Bromo</h3><p>KABUPATEN LUMAJANG, Jawa Timur</p></div>
  <div data-tabs-id="cont-a2tabs1" class="container-tabs active">${card(1, 'Bromo')}</div>
  <div data-tabs-id="cont-a2tabs3" class="container-tabs">${card(2, 'Museum')}</div>
  <script>map1.addMarker({lat: -8.0218747, lng: 112.9524384, title: 'Bromo',
  infoWindow: {content: '<p><a href="/unit/1">Bromo</a></p>'}});</script>`;
  const parsed = parseDirectoryDetail(detail);
  assert.equal(parsed.sourceProvince, 'Jawa Timur');
  assert.deepEqual(parsed.records.find(record => record.officialId === '1'), {
    officialId: '1', name: 'Bromo', sourceUrl: 'https://www.direktoripariwisata.id/unit/1',
    kind: 'natural', sourceCategory: 1, lat: -8.0218747, lon: 112.9524384
  });
  assert.equal(parsed.records.find(record => record.officialId === '2').kind, 'built');
});

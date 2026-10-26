import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDisaster } from '../../scripts/pipeline/lib/classify.mjs';
import { dedupeNews, limitPerDomain } from '../../scripts/pipeline/lib/dedupe.mjs';
import { makeEvent, RejectionCounter } from '../../scripts/pipeline/lib/event.mjs';
import { buildGazetteer } from '../../scripts/pipeline/lib/gazetteer.mjs';
import { canonicalUrl, cleanText, cleanTitle, parseInstant } from '../../scripts/pipeline/lib/text.mjs';
import { eventsFromFeed } from '../../scripts/pipeline/sources/antara.mjs';
import { eventsFromRows, parseTable } from '../../scripts/pipeline/sources/bnpb-dibi.mjs';
import { eventsFromArticles, parseArticles } from '../../scripts/pipeline/sources/gdelt.mjs';
import { eventsFromReports } from '../../scripts/pipeline/sources/petabencana.mjs';

const NOW = Date.parse('2026-10-27T00:00:00Z');
const gazetteer = await buildGazetteer();

test('cleaning strips markup, entities, control characters and outlet suffixes', () => {
  assert.equal(cleanText('<b>Banjir&nbsp;&amp; longsor</b>\u0000  di   Agam'), 'Banjir & longsor di Agam');
  assert.equal(cleanTitle('[VIDEO] Banjir bandang landa Agam - ANTARA News'), 'Banjir bandang landa Agam');
  assert.equal(cleanText('x'.repeat(400), 50).length, 50);
});

test('URLs are canonicalised to credential-free https without tracking parameters', () => {
  assert.equal(canonicalUrl('http://www.example.com/a/?utm_source=x&id=2#frag'), 'https://example.com/a?id=2');
  assert.equal(canonicalUrl('https://user:pass@example.com/a'), undefined);
  assert.equal(canonicalUrl('javascript:alert(1)'), undefined);
});

test('instants parse RFC 822 and GDELT forms and reject garbage', () => {
  assert.equal(parseInstant('20261027T013000Z'), '2026-10-27T01:30:00.000Z');
  assert.equal(parseInstant('Mon, 19 Oct 2026 07:28:04 +0700'), '2026-10-19T00:28:04.000Z');
  assert.equal(parseInstant('not a date'), undefined);
});

for (const [headline, expected] of [
  ['Banjir bandang terjang Kabupaten Agam', 'flood'],
  ['Longsor tutup jalan lintas Sumatera', 'landslide'],
  ['Gempa M5,2 guncang Bengkulu', 'earthquake'],
  ['Erupsi Gunung Semeru, awan panas meluncur', 'volcano'],
  ['Karhutla meluas di Jambi', 'fire'],
  ['Kabut asap selimuti Pekanbaru', 'haze'],
  ['Puting beliung rusak puluhan rumah', 'wind'],
  ['Gelombang pasang hantam pesisir Demak', 'tide'],
  ['Banjir promo akhir tahun di toko online', undefined],
  ['Gempa politik jelang pemilihan', undefined],
  ['Mengenal sejarah banjir besar Jakarta', undefined],
  ['Harga cabai naik di pasar', undefined]
]) {
  test(`classifies "${headline}" as ${expected}`, () => assert.equal(classifyDisaster(headline), expected));
}

test('gazetteer resolves regencies, downgrades ambiguity and ignores foreign places', () => {
  assert.equal(gazetteer.findInText('Longsor di Kabupaten Agam, Sumatera Barat').code, '13.06');
  const ambiguous = gazetteer.findInText('Banjir rendam Bandung');
  assert.equal(ambiguous.precision, 'province');
  assert.equal(ambiguous.lon, undefined);
  assert.equal(gazetteer.findInText('Gempa guncang Turki'), undefined);
  assert.equal(gazetteer.findInText('Kebakaran di Kota Batu').code, '35.79');
  const point = gazetteer.byCode('11.73');
  assert.ok(point.lon > 96 && point.lon < 98 && point.lat > 4 && point.lat < 6);
});

test('makeEvent drops coordinates for province precision and rejects invalid input', () => {
  const base = { id: 'x:1', kind: 'news', source: 'Test', type: 'flood', title: 'Banjir di Agam', occurredAt: '2026-10-26T00:00:00Z', lon: 100, lat: -0.2 };
  assert.equal(makeEvent({ ...base, precision: 'province' }).lon, undefined);
  assert.equal(makeEvent({ ...base, precision: 'regency' }).lon, 100);
  assert.throws(() => makeEvent({ ...base, type: 'zombies' }), /invalid-type/);
  assert.throws(() => makeEvent({ ...base, occurredAt: 'nope' }), /invalid-date/);
  assert.deepEqual(makeEvent({ ...base, impact: { deaths: -1, injured: 3, missing: Number.NaN } }).impact, { injured: 3 });
});

function news(id, title, url, source = 'GDELT', hours = 0) {
  return makeEvent({ id, kind: 'news', source, type: 'flood', title, url, occurredAt: new Date(NOW - hours * 3600_000).toISOString() });
}

test('news dedupe merges identical URLs and near-identical headlines, preferring ANTARA', () => {
  const items = [
    news('a', 'Banjir bandang rendam ratusan rumah di Agam Sumatera Barat', 'https://one.example/a', 'GDELT'),
    news('b', 'Banjir bandang rendam ratusan rumah di Agam, Sumatera Barat', 'https://antaranews.com/b', 'ANTARA News'),
    news('c', 'Banjir bandang rendam ratusan rumah di Agam Sumatera Barat', 'https://one.example/a', 'GDELT', 1),
    news('d', 'Harga sembako stabil jelang akhir pekan di Padang', 'https://two.example/d', 'GDELT')
  ];
  const { events, merged } = dedupeNews(items);
  assert.equal(merged, 2);
  assert.equal(events.length, 2);
  assert.equal(events.find(event => event.id === 'b').alsoReportedBy.length, 1);
  assert.equal(limitPerDomain(items, 1).length, 3);
});

test('GDELT parsing handles empty, article and non-JSON responses', () => {
  assert.deepEqual(parseArticles('{}'), []);
  assert.throws(() => parseArticles('Please limit requests to one every 5 seconds'), /non-JSON/);
  const articles = parseArticles(JSON.stringify({ articles: [
    { url: 'https://example.id/banjir?utm_source=x', title: 'Banjir rendam Kabupaten Agam', seendate: '20261026T120000Z', domain: 'example.id', socialimage: 'https://img' },
    { url: 'https://example.com/turkey', title: 'Gempa guncang Turki', seendate: '20261026T120000Z' },
    { url: 'https://example.id/old', title: 'Banjir lama di Agam', seendate: '20260901T120000Z' }
  ] }));
  const rejections = new RejectionCounter();
  const events = eventsFromArticles(articles, gazetteer, NOW, rejections);
  assert.equal(events.length, 1);
  assert.equal(events[0].url, 'https://example.id/banjir');
  assert.equal(events[0].regionCode, '13.06');
  assert.equal(events[0].image, undefined);
  assert.deepEqual(rejections.toObject(), { 'no-indonesia-context': 1, 'too-old': 1 });
});

test('ANTARA RSS keeps headline and link only', () => {
  const xml = `<rss><channel>
    <item><title>Longsor timbun rumah di Kabupaten Agam - ANTARA News</title><link>https://www.antaranews.com/berita/1/longsor</link><pubDate>Mon, 26 Oct 2026 07:28:04 +0700</pubDate><description><![CDATA[<img src="https://img/x.jpg" />Longsor terjadi pada malam hari]]></description></item>
    <item><title>Cara membuat kompos</title><link>https://www.antaranews.com/berita/2/kompos</link><pubDate>Mon, 26 Oct 2026 07:28:04 +0700</pubDate><description>Tips</description></item>
  </channel></rss>`;
  const rejections = new RejectionCounter();
  const events = eventsFromFeed(xml, gazetteer, NOW, rejections);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'landslide');
  assert.equal(events[0].title, 'Longsor timbun rumah di Kabupaten Agam');
  assert.equal(events[0].detail, undefined);
  assert.equal(rejections.toObject().noise, 1);
});

const DIBI_HEAD = '<thead><tr><th>No</th><th>Kode</th><th>ID Kabupaten</th><th>Tanggal</th><th>Kejadian</th><th>Lokasi</th><th>Kabupaten</th><th>Provinsi</th><th>Dok</th><th>Penyebab</th><th>Meninggal</th><th>Hilang</th><th>Terluka</th><th>Rumah Rusak</th><th>Rumah Terendam</th><th>Fasum Rusak</th></tr></thead>';
function dibiRow(cells) { return '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>'; }

test('BNPB DIBI rows become official events with regency points and impact counts', () => {
  const html = `<table>${DIBI_HEAD}<tbody>${dibiRow(['1', '', '1173', '2026-10-25', 'CUACA EKSTREM', 'Kecamatan:\\nKec. Banda Sakti', 'Kota Lhokseumawe', 'Aceh', '', '', '2', '', '1', '27', '', '3'])}${dibiRow(['2', '', '9999', '2026-10-24', 'BANJIR', 'Kec. X', 'Tidak Ada', 'Nowhere', '', '', '', '', '', '', '', ''])}${dibiRow(['3', '', '1211', '2026-10-24', 'UFO', 'x', 'Dairi', 'Sumatera Utara', '', '', '', '', '', '', '', ''])}</tbody></table>`;
  const rejections = new RejectionCounter();
  const events = eventsFromRows(parseTable(html), gazetteer, NOW, rejections);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, 'official');
  assert.equal(events[0].type, 'wind');
  assert.equal(events[0].precision, 'regency');
  assert.deepEqual(events[0].impact, { deaths: 2, injured: 1, housesDamaged: 27, facilitiesDamaged: 3 });
  assert.equal(events[1].lon, undefined);
  assert.deepEqual(rejections.toObject(), { 'unknown-event-type': 1 });
});

test('BNPB DIBI parsing fails closed when the table layout changes', () => {
  assert.throws(() => parseTable('<table><thead><tr><th>Other</th></tr></thead><tbody></tbody></table>'), /header changed/);
  assert.throws(() => parseTable(`<table>${DIBI_HEAD}<tbody>${dibiRow(['1', '2'])}</tbody></table>`), /column count/);
});

test('PetaBencana reports become citizen point events and unsupported types are rejected', () => {
  const features = [
    { geometry: { coordinates: [97.9, 4.2] }, properties: { pkey: '1', created_at: '2026-10-26T14:40:51Z', disaster_type: 'flood', text: 'Banjir <b>setinggi</b> lutut', tags: { city: 'ACEH TAMIANG' }, report_data: { flood_depth: 20 } } },
    { geometry: { coordinates: [97.9, 4.2] }, properties: { pkey: '2', created_at: '2026-10-26T14:40:51Z', disaster_type: 'ufo' } }
  ];
  const rejections = new RejectionCounter();
  const events = eventsFromReports(features, rejections);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Banjir setinggi lutut');
  assert.equal(events[0].precision, 'point');
  assert.equal(events[0].floodDepthCm, 20);
  assert.deepEqual(rejections.toObject(), { 'unsupported-type': 1 });
});

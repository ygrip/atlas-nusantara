import test from 'node:test';
import assert from 'node:assert/strict';
import { Color } from 'three';
import {
  HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MAX_YEAR, HISTORY_MIN_YEAR,
  historyActive, historyCategoryAt, historyRulersAt, historyZonesAt, isHistoricalPolity
} from '../../src/lib/data/history.ts';
import { BATUJAYA_SITE, historyPolityColor, influenceOpacity, historyRadiusDegrees } from '../../src/lib/map/history-map.ts';

test('historical gazetteer has unique validated records and historical citations', () => {
  assert.ok(HISTORICAL_POLITIES.length >= 90);
  const ids = HISTORICAL_POLITIES.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of HISTORICAL_POLITIES) {
    assert.ok(isHistoricalPolity(p), 'invalid polity ' + p.id);
    assert.ok(p.summary.en.trim().length >= 70, 'missing English narrative: ' + p.id);
    assert.ok(p.summary.id.trim().length >= 65, 'missing Indonesian narrative: ' + p.id);
    assert.ok(p.rulers.every(r => r.name && (!r.from || r.from <= (r.to ?? Infinity))), 'bad reign: ' + p.id);
    assert.ok(p.zones.every(z => (z.from ?? p.from) >= p.from && (z.to ?? p.to) <= p.to), 'zone beyond documented polity dates: ' + p.id);
  }
});
test('playable timeline covers archaeology through the present with distinct modern states', () => {
  assert.equal(HISTORY_MIN_YEAR, -400);
  assert.equal(HISTORY_MAX_YEAR, new Date().getUTCFullYear());
  assert.deepEqual(historyActive(1945).map(polity => polity.id), ['indonesia']);
  assert.deepEqual(new Set(historyActive(HISTORY_MAX_YEAR).map(polity => polity.id)), new Set(['indonesia', 'timor-leste']));
  const years = HISTORY_EVENTS.map(e => e.year);
  assert.equal(years[0], HISTORY_MIN_YEAR);
  assert.ok(years.at(-1) <= HISTORY_MAX_YEAR);
  assert.deepEqual(years, [...years].sort((a,b) => a - b));
  assert.ok(historyActive(682).some(p => p.id === 'srivijaya'));
  assert.ok(historyActive(1350).some(p => p.id === 'majapahit'));
  assert.ok(historyActive(1944).some(p => p.id === 'japanese-occupation'));
  assert.ok(historyZonesAt(1944).every(zone => zone.confidence !== undefined));
});
test('early evidence and dated centres remain distinct from invented borders', () => {
  assert.ok(historyActive(375).some(polity => polity.id === 'kutai-martadipura'));
  assert.equal(historyActive(-50).length, 0);
  assert.ok(BATUJAYA_SITE.from <= -50 && BATUJAYA_SITE.to >= -50);
  const before = historyZonesAt(1855).find(zone => zone.id === 'tanjungpura');
  const after = historyZonesAt(1856).find(zone => zone.id === 'tanjungpura');
  assert.ok(before && after);
  assert.notEqual(before.lat, after.lat);
  const colors = HISTORICAL_POLITIES.map(polity => new Color(historyPolityColor(polity.id)).getHexString());
  assert.equal(new Set(colors).size, colors.length);
});

test('the historical cartography has distinct confidence bands and finite geometry', () => {
  assert.ok(influenceOpacity('attested-centre') > influenceOpacity('approximate-core'));
  assert.ok(influenceOpacity('approximate-core') > influenceOpacity('contested-influence'));
  for (const p of HISTORICAL_POLITIES) for (const zone of p.zones) {
    const degrees = historyRadiusDegrees(zone.radiusKm, zone.lat);
    assert.ok(degrees > 0 && Number.isFinite(degrees));
  }
});
test('Buton is not presented as a sultanate before the documented Islamization period', () => {
  const buton = HISTORICAL_POLITIES.find(p => p.id === 'buton');
  assert.ok(buton);
  assert.equal(historyCategoryAt(buton, 1400), 'regional');
  assert.equal(historyCategoryAt(buton, 1542), 'islamic');
});

test('rulers are selected by contemporaneous dates, without inventing reigns', () => {
  const majapahit = HISTORICAL_POLITIES.find(p => p.id === 'majapahit');
  assert.ok(majapahit);
  assert.ok(historyRulersAt(majapahit, 1370).some(r => r.name === 'Hayam Wuruk'));
  assert.equal(historyRulersAt(majapahit, 1700).length, 0);
});

const REGIONS = ['sumatra','java','bali','borneo','sulawesi','nusa-tenggara','maluku','papua','malay-peninsula','archipelago'];
const GENERIC_SOURCES = ['https://id.wikipedia.org/wiki/Sejarah_Nusantara', 'https://geoservices.big.go.id/'];

test('every record has a region, bilingual place text and a record-specific source', () => {
  for (const p of HISTORICAL_POLITIES) {
    assert.ok(REGIONS.includes(p.region), 'bad region: ' + p.id);
    assert.ok(p.place.trim() && p.placeId.trim(), 'missing place text: ' + p.id);
    const specific = p.sources.filter(url => !GENERIC_SOURCES.some(generic => url.startsWith(generic)));
    assert.ok(specific.length >= 1, 'only generic sources: ' + p.id);
    if (p.dateNote) assert.ok(p.dateNote.en.trim() && p.dateNote.id.trim(), 'dateNote needs en and id: ' + p.id);
  }
});

test('zone centres stay within the Nusantara bounding box and every region is represented', () => {
  for (const p of HISTORICAL_POLITIES) for (const z of p.zones) {
    assert.ok(z.lon >= 95 && z.lon <= 141 && z.lat >= -11 && z.lat <= 6, 'zone outside the archipelago: ' + p.id);
  }
  for (const region of REGIONS) {
    assert.ok(HISTORICAL_POLITIES.some(p => p.region === region), 'no polity in region ' + region);
  }
});

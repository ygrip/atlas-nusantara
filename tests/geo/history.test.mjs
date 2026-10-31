import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORICAL_POLITIES, HISTORY_EVENTS, HISTORY_MAX_YEAR, HISTORY_MIN_YEAR,
  historyActive, historyRulersAt, historyZonesAt, isHistoricalPolity
} from '../../src/lib/data/history.ts';
import { influenceOpacity, historyRadiusDegrees } from '../../src/lib/map/history-map.ts';

test('historical gazetteer has unique validated records and historical citations', () => {
  assert.ok(HISTORICAL_POLITIES.length >= 30);
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
test('playable timeline covers archaeology through last full pre-independence year', () => {
  assert.equal(HISTORY_MIN_YEAR, -400);
  assert.equal(HISTORY_MAX_YEAR, 1944);
  assert.equal(historyActive(1945).length, 0);
  const years = HISTORY_EVENTS.map(e => e.year);
  assert.equal(years[0], HISTORY_MIN_YEAR);
  assert.equal(years.at(-1), HISTORY_MAX_YEAR);
  assert.deepEqual(years, [...years].sort((a,b) => a - b));
  assert.ok(historyActive(682).some(p => p.id === 'srivijaya'));
  assert.ok(historyActive(1350).some(p => p.id === 'majapahit'));
  assert.ok(historyActive(1944).some(p => p.id === 'japanese-occupation'));
  assert.ok(historyZonesAt(1944).every(zone => zone.confidence !== undefined));
});
test('the historical cartography has distinct confidence bands and finite geometry', () => {
  assert.ok(influenceOpacity('attested-centre') > influenceOpacity('approximate-core'));
  assert.ok(influenceOpacity('approximate-core') > influenceOpacity('contested-influence'));
  for (const p of HISTORICAL_POLITIES) for (const zone of p.zones) {
    const degrees = historyRadiusDegrees(zone.radiusKm, zone.lat);
    assert.ok(degrees > 0 && Number.isFinite(degrees));
  }
});
test('rulers are selected by contemporaneous dates, without inventing reigns', () => {
  const majapahit = HISTORICAL_POLITIES.find(p => p.id === 'majapahit');
  assert.ok(majapahit);
  assert.ok(historyRulersAt(majapahit, 1370).some(r => r.name === 'Hayam Wuruk'));
  assert.equal(historyRulersAt(majapahit, 1700).length, 0);
});

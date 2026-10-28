import test from 'node:test';
import assert from 'node:assert/strict';
import { isDaytimeAt } from '../../src/lib/places/weather-scene.ts';
import { formatInZone, timeZoneForRegionCode } from '../../src/lib/places/time-zone.ts';

test('regions map to their own Indonesian time zone', () => {
  for (const [code, abbreviation] of [
    ['35.77', 'WIB'], ['11', 'WIB'], ['62.01', 'WIB'], ['61', 'WIB'], ['21.71', 'WIB'],
    ['51.71', 'WITA'], ['64.74', 'WITA'], ['73', 'WITA'], ['53.01', 'WITA'],
    ['81', 'WIT'], ['91.71', 'WIT'], ['96', 'WIT'], ['82.01', 'WIT']
  ]) {
    assert.equal(timeZoneForRegionCode(code).abbreviation, abbreviation, code);
  }
});

test('an instant is formatted on the place clock, not the runtime clock', () => {
  const instant = '2026-10-28T01:00:00Z';
  assert.equal(formatInZone(instant, timeZoneForRegionCode('35'), 'en-GB', { hour: '2-digit', minute: '2-digit' }), '08:00');
  assert.equal(formatInZone(instant, timeZoneForRegionCode('51'), 'en-GB', { hour: '2-digit', minute: '2-digit' }), '09:00');
  assert.equal(formatInZone(instant, timeZoneForRegionCode('91'), 'en-GB', { hour: '2-digit', minute: '2-digit' }), '10:00');
});

test('day and night follow the sun at the place', () => {
  // Madiun (-7.63, 111.52), late October: sunrise about 05:20 and sunset about 17:35 local (WIB).
  const madiun = [-7.63, 111.52];
  assert.equal(isDaytimeAt('2026-10-27T21:30:00Z', ...madiun), false, '04:30 WIB is still dark');
  assert.equal(isDaytimeAt('2026-10-27T23:30:00Z', ...madiun), true, '06:30 WIB is day');
  assert.equal(isDaytimeAt('2026-10-28T09:00:00Z', ...madiun), true, '16:00 WIB is day');
  assert.equal(isDaytimeAt('2026-10-28T11:30:00Z', ...madiun), false, '18:30 WIB is night');
  // The same instant is day in Jayapura (WIT, UTC+9) and night in Banda Aceh (WIB, UTC+7).
  assert.equal(isDaytimeAt('2026-10-27T21:30:00Z', -2.53, 140.72), true, '06:30 WIT is day');
  assert.equal(isDaytimeAt('2026-10-27T21:30:00Z', 5.55, 95.32), false, '04:30 WIB is night');
});

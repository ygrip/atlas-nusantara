import assert from 'node:assert/strict';
import test from 'node:test';
import { countBySeverity, severityLevel, sortWarnings, splitAreas, timeLeft } from '../../src/lib/data/warning-view.ts';

const warning = (id, severity, expires) => ({ id, severity, expires, event: 'e', headline: 'h', description: '', urgency: null, certainty: null, effective: expires, areaDescriptions: '', sourceLink: '', centroid: { lon: 0, lat: 0 } });

test('severity is case-insensitive and unknown values read as minor', () => {
  assert.deepEqual(['Extreme', 'SEVERE', 'moderate', 'Minor', null, 'Weird'].map(severityLevel), ['extreme', 'severe', 'moderate', 'minor', 'minor', 'minor']);
});

test('warnings sort by severity, then by the soonest end', () => {
  const sorted = sortWarnings([warning('a', 'Moderate', '2026-01-01T02:00:00Z'), warning('b', 'Extreme', '2026-01-01T09:00:00Z'), warning('c', 'Moderate', '2026-01-01T01:00:00Z')]);
  assert.deepEqual(sorted.map(item => item.id), ['b', 'c', 'a']);
  assert.deepEqual(countBySeverity(sorted), { extreme: 1, severe: 0, moderate: 2, minor: 0 });
});

test('areas split on commas, trim and drop duplicates', () => {
  assert.deepEqual(splitAreas('Jakarta, Bogor ,, Jakarta; Depok'), ['Jakarta', 'Bogor', 'Depok']);
  assert.deepEqual(splitAreas(''), []);
});

test('time left picks minutes, hours or days and is undefined after the end', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.deepEqual(timeLeft('2026-01-01T00:40:00Z', now), { value: 40, unit: 'minute' });
  assert.deepEqual(timeLeft('2026-01-01T05:00:00Z', now), { value: 5, unit: 'hour' });
  assert.deepEqual(timeLeft('2026-01-05T00:00:00Z', now), { value: 4, unit: 'day' });
  assert.equal(timeLeft('2025-12-31T23:00:00Z', now), undefined);
  assert.equal(timeLeft('not a date', now), undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDestinations, paginateDestinations, sortDestinations } from '../../src/lib/data/destination-table.ts';

const records = [
  { id: 'c', name: 'Zebra Beach', kind: 'natural', sourceDistrict: 'Bali', officialId: 'ID-3', image: { url: 'photo' } },
  { id: 'b', name: 'Museum Kota', kind: 'built', sourceDistrict: 'Jakarta', officialId: 'ID-2' },
  { id: 'a', name: 'Pantai Café', kind: 'unknown', sourceDistrict: 'Bali', officialId: 'ID-1' }
];

test('search matches normalized name, district, and official identifier', () => {
  assert.deepEqual(filterDestinations(records, { query: 'cafe' }).map(row => row.id), ['a']);
  assert.deepEqual(filterDestinations(records, { query: 'jakarta' }).map(row => row.id), ['b']);
  assert.deepEqual(filterDestinations(records, { query: 'id-3' }).map(row => row.id), ['c']);
});

test('kind, district, and image filters compose without mutating input', () => {
  const snapshot = structuredClone(records);
  assert.deepEqual(filterDestinations(records, { kind: 'natural', district: 'bali', image: 'with-image' }).map(row => row.id), ['c']);
  assert.deepEqual(filterDestinations(records, { image: 'without-image' }).map(row => row.id), ['b', 'a']);
  assert.deepEqual(records, snapshot);
});

for (const [key, direction, expected] of [
  ['name', 'ascending', ['b', 'a', 'c']],
  ['district', 'ascending', ['a', 'c', 'b']],
  ['kind', 'descending', ['a', 'c', 'b']]
]) {
  test(`sorts ${key} ${direction} without mutating input`, () => {
    const source = structuredClone(records);
    assert.deepEqual(sortDestinations(records, key, direction, 'en').map(row => row.id), expected);
    assert.deepEqual(records, source);
  });
}

test('pagination clamps requested pages and reports bounded ranges', () => {
  const first = paginateDestinations(records, 0, 2);
  assert.deepEqual(first, { items: records.slice(0, 2), page: 0, pageCount: 2, start: 1, end: 2, total: 3 });
  const clamped = paginateDestinations(records, 9, 2);
  assert.deepEqual(clamped, { items: records.slice(2), page: 1, pageCount: 2, start: 3, end: 3, total: 3 });
  assert.equal(paginateDestinations(records, Number.NaN, 2).page, 0);
  assert.deepEqual(paginateDestinations([], 4, 25), { items: [], page: 0, pageCount: 1, start: 0, end: 0, total: 0 });
});

test('pagination rejects non-positive page sizes', () => {
  assert.throws(() => paginateDestinations(records, 0, 0), RangeError);
  assert.throws(() => paginateDestinations(records, 0, 1.5), RangeError);
});

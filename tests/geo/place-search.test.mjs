import assert from 'node:assert/strict';
import test from 'node:test';
import { searchPlaces } from '../../src/lib/atlas/place-search.ts';

const options = [
  { code: '32', name: 'Jawa Barat', level: 'province' },
  { code: '32.73', name: 'Kota Bandung', level: 'city', parentName: 'Jawa Barat' },
  { code: '32.04', name: 'Kabupaten Bandung', level: 'city', parentName: 'Jawa Barat' },
  { code: '51', name: 'Bali', level: 'province' },
  { code: '51.71', name: 'Kota Denpasar', level: 'city', parentName: 'Bali' }
];

test('an empty query keeps directory order', () => assert.deepEqual(searchPlaces(options, '  '), options));

test('name prefix outranks word prefix, which outranks parent matches', () => {
  assert.deepEqual(searchPlaces(options, 'bali').map(item => item.code), ['51', '51.71']);
  assert.deepEqual(searchPlaces(options, 'band').map(item => item.code), ['32.04', '32.73']);
  assert.deepEqual(searchPlaces(options, 'jawa').map(item => item.code), ['32', '32.04', '32.73']);
});

test('matching ignores case and accents and also finds codes', () => {
  assert.deepEqual(searchPlaces(options, 'KÓTA dén').map(item => item.code), ['51.71']);
  assert.deepEqual(searchPlaces(options, 'dénpasar').map(item => item.code), ['51.71']);
  assert.deepEqual(searchPlaces(options, '32.7').map(item => item.code), ['32.73']);
});

test('no match returns an empty list', () => assert.deepEqual(searchPlaces(options, 'zzz'), []));

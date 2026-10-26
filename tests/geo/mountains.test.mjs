import test from 'node:test';
import assert from 'node:assert/strict';
import { mountainCategory, mountainName, makeMountainOverlay } from '../../scripts/geo/mountains-source.mjs';

const record = (OBJECTID, name, x, y, extra = {}) =>
  ({ attributes: { OBJECTID, NAMA_OBJEK: name, NAMA_UNSUR: 'Gunung / Puncak', TOPONIM: name, ...extra }, geometry: { x, y } });

test('BIG A/B/C classification never mislabels B/C as extinct', () => {
  assert.equal(mountainCategory('Tipe A'), 'active');
  assert.equal(mountainCategory('Bawah Laut Tipe A'), 'active');
  assert.equal(mountainCategory('Tipe B'), 'potential');
  assert.equal(mountainCategory('Tipe C'), 'potential');
  assert.equal(mountainCategory(undefined), 'other');
});

test('national mountain inventory joins matching volcanoes without fabricating inactivity', () => {
  const overlay = makeMountainOverlay(
    [record(1, 'Gunung Merapi', 110.45, -7.54), record(2, 'Puncak Jaya', 137.18, -4.08), record(3, '', 136, -5)],
    [record(40, 'Merapi', 110.44, -7.53, { TIPE: 'Tipe A', KETINGGIAN: 2910 })],
    '2026-10-27T00:00:00Z'
  );
  assert.equal(overlay.pins.length, 2);
  assert.equal(overlay.pins.find(x => x.category === 'active')?.value, 2910);
  assert.equal(overlay.pins.find(x => x.category === 'other')?.label, 'Gunung Puncak Jaya');
  assert.equal(mountainName('G. Ceremai'), 'Ceremai');
});

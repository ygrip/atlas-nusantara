import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleMountainPins } from '../../src/lib/map/mountain-density.ts';

test('mountain pins declutter at national zoom but preserve all classified volcanoes', () => {
  const pins = [
    { id: 'a', lat: -6.1, lon: 106.1, category: 'other' },
    { id: 'b', lat: -6.2, lon: 106.2, category: 'other' },
    { id: 'c', lat: -6.2, lon: 106.3, category: 'active' },
    { id: 'd', lat: -6.3, lon: 106.4, category: 'potential' }
  ];
  const national = visibleMountainPins(pins, 1);
  assert.deepEqual(national.map(pin => pin.id), ['a', 'c', 'd']);
  assert.equal(visibleMountainPins(pins, 4).length, 4);
  assert.equal(visibleMountainPins(pins, 1, 'province').length, 4);
  assert.equal(visibleMountainPins([], 1).length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { niceScale } from '../../src/lib/data/chart-scale.ts';

for (const [largest, max, ticks] of [
  [287.2, 300, [0, 100, 200, 300]],
  [51.2, 60, [0, 20, 40, 60]],
  [700.3, 800, [0, 200, 400, 600, 800]],
  [0, 1, [0, 1]]
]) {
  test(`axis for ${largest} starts at zero with round ticks`, () => {
    const scale = niceScale(largest, 4);
    assert.equal(scale.max, max);
    assert.deepEqual(scale.ticks, ticks);
  });
}

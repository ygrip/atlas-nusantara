import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_LIMITS, fitMapDistance } from '../../src/lib/map/camera.ts';

for (const [width, height] of [[300, 440], [342, 440], [728, 680], [1150, 680]]) {
  test(`the whole archipelago fits a ${width}×${height} map without hitting the zoom-out limit`, () => {
    const aspect = width / height;
    const distance = fitMapDistance([20, 30, 980, 470], aspect, 1);
    const horizontalSpan = 2 * distance * Math.tan(CAMERA_LIMITS.fov * Math.PI / 360) * aspect;
    assert.ok(horizontalSpan >= 960 * 1.1);
    assert.ok(distance < CAMERA_LIMITS.maxDistance);
  });
}

test('tiny city bounds stop at the minimum camera distance', () => {
  assert.equal(fitMapDistance([1, 1, 1.001, 1.001], 1), CAMERA_LIMITS.minDistance * 2);
});

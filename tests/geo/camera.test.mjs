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

test('compact home framing uses the map viewport more closely while retaining a safety margin', () => {
  const bounds = [20, 30, 980, 470];
  const aspect = 360 / 420;
  const standardDistance = fitMapDistance(bounds, aspect, 1);
  const compactDistance = fitMapDistance(bounds, aspect, 0.94);
  const horizontalSpan = 2 * compactDistance * Math.tan(CAMERA_LIMITS.fov * Math.PI / 360) * aspect;

  assert.ok(compactDistance < standardDistance);
  assert.ok(horizontalSpan >= (bounds[2] - bounds[0]) * 1.05);
});

test('tiny city bounds stop at the minimum camera distance', () => {
  assert.equal(fitMapDistance([1, 1, 1.001, 1.001], 1), CAMERA_LIMITS.minDistance * 2);
});

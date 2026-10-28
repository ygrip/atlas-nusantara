import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTwoFingerIntent, MapTouchGestures } from '../../src/lib/map/touch-gestures.ts';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';

const start = [{ x: 100, y: 100 }, { x: 200, y: 100 }];

test('pinch intent wins over incidental centroid drift and remains available for caller locking', () => {
  assert.equal(classifyTwoFingerIntent(start, [{ x: 92, y: 102 }, { x: 210, y: 100 }]), 'pinch');
});

test('twisting fingers classify as rotation rather than dolly or tilt', () => {
  assert.equal(classifyTwoFingerIntent(start, [{ x: 103, y: 91 }, { x: 197, y: 109 }]), 'rotate');
});

test('parallel vertical movement classifies as tilt', () => {
  assert.equal(classifyTwoFingerIntent(start, [{ x: 100, y: 120 }, { x: 200, y: 120 }]), 'tilt');
});

test('parallel horizontal movement classifies as pan', () => {
  assert.equal(classifyTwoFingerIntent(start, [{ x: 120, y: 100 }, { x: 220, y: 100 }]), 'pan');
});

test('small movement remains unclassified to ignore centroid jitter', () => {
  assert.equal(classifyTwoFingerIntent(start, [{ x: 101, y: 101 }, { x: 201, y: 101 }]), undefined);
});

test('rotation angle wraps across the negative-pi boundary', () => {
  const nearBoundary = [{ x: 100, y: 100 }, { x: 0, y: 101 }];
  assert.equal(classifyTwoFingerIntent(nearBoundary, [{ x: 100, y: 100 }, { x: 0, y: 80 }]), 'rotate');
});

function gestureHarness(t) {
  const oldFrame = globalThis.requestAnimationFrame;
  const oldCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextFrame = 1;
  globalThis.requestAnimationFrame = callback => { const id = nextFrame++; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const element = new EventTarget();
  Object.defineProperty(element, 'clientHeight', { value: 400 });
  const camera = new PerspectiveCamera(32, 1, 1, 14000);
  camera.position.set(0, 300, 400);
  const controls = {
    enabled: true, enableZoom: true, enableRotate: true, enablePan: true, enableDamping: true,
    minDistance: 12, maxDistance: 6500, minPolarAngle: 0, maxPolarAngle: 1.3,
    minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, touches: {}, target: new Vector3(),
    update() { camera.lookAt(this.target); camera.updateMatrixWorld(); }
  };
  controls.update();
  const gestures = new MapTouchGestures({ element, camera, controls, onInteraction() {}, onGesture() {} });
  t.after(() => {
    gestures.destroy();
    globalThis.requestAnimationFrame = oldFrame;
    globalThis.cancelAnimationFrame = oldCancel;
  });
  function pointer(type, id, x, y) {
    element.dispatchEvent(Object.assign(new Event(type), { pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
  }
  function flush() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(0); }
  function pose() { return new Spherical().setFromVector3(camera.position.clone().sub(controls.target)); }
  pointer('pointerdown', 1, 100, 100);
  pointer('pointerdown', 2, 200, 100);
  return { camera, controls, pointer, flush, pose };
}

for (const scenario of [
  { name: 'pinch', points: [[80, 100], [220, 100]], changed: 'radius' },
  { name: 'twist', points: [[110, 80], [190, 120]], changed: 'theta' },
  { name: 'parallel vertical drag', points: [[100, 120], [200, 120]], changed: 'phi' }
]) {
  test(`${scenario.name} changes only its intended camera dimension`, t => {
    const fixture = gestureHarness(t);
    const before = fixture.pose();
    fixture.pointer('pointermove', 1, ...scenario.points[0]);
    fixture.pointer('pointermove', 2, ...scenario.points[1]);
    fixture.flush();
    const after = fixture.pose();
    for (const dimension of ['radius', 'theta', 'phi']) {
      const difference = Math.abs(after[dimension] - before[dimension]);
      if (dimension === scenario.changed) assert.ok(difference > 0.01, dimension);
      else assert.ok(difference < 0.000001, dimension);
    }
  });
}

test('clockwise finger twist rotates a screen-right landmark clockwise', t => {
  const fixture = gestureHarness(t);
  const before = new Vector3(10, 0, 0).project(fixture.camera);
  fixture.pointer('pointermove', 1, 110, 80);
  fixture.pointer('pointermove', 2, 190, 120);
  fixture.flush();
  const after = new Vector3(10, 0, 0).project(fixture.camera);
  assert.ok(before.x > 0);
  assert.ok(after.y < before.y);
});

test('an added third finger freezes the pair until all touches lift', t => {
  const fixture = gestureHarness(t);
  fixture.pointer('pointermove', 1, 80, 100);
  fixture.pointer('pointermove', 2, 220, 100);
  fixture.flush();
  const before = fixture.pose();
  fixture.pointer('pointerdown', 3, 300, 200);
  fixture.pointer('pointerup', 1, 80, 100);
  fixture.pointer('pointermove', 2, 100, 150);
  fixture.pointer('pointermove', 3, 350, 250);
  fixture.flush();
  assert.ok(Math.abs(fixture.pose().radius - before.radius) < 0.000001);
  assert.equal(fixture.controls.enableZoom, false);
  fixture.pointer('pointerup', 2, 100, 150);
  fixture.pointer('pointerup', 3, 350, 250);
  assert.equal(fixture.controls.enableZoom, true);
});

test('cancellation discards an unrendered pinch instead of moving the camera', t => {
  const fixture = gestureHarness(t);
  const before = fixture.pose();
  fixture.pointer('pointermove', 1, 80, 100);
  fixture.pointer('pointercancel', 1, 80, 100);
  fixture.flush();
  assert.ok(Math.abs(fixture.pose().radius - before.radius) < 0.000001);
});

test('a locked pinch ignores later parallel drift and restores controls after cancellation', t => {
  const fixture = gestureHarness(t);
  const original = fixture.pose();
  fixture.pointer('pointermove', 1, 80, 100);
  fixture.pointer('pointermove', 2, 220, 100);
  fixture.flush();
  fixture.pointer('pointermove', 1, 80, 150);
  fixture.pointer('pointermove', 2, 220, 150);
  fixture.flush();
  assert.ok(Math.abs(fixture.pose().phi - original.phi) < 0.000001);
  fixture.pointer('pointercancel', 1, 80, 150);
  assert.equal(fixture.controls.enableRotate, true);
  assert.equal(fixture.controls.enableZoom, true);
  assert.equal(fixture.controls.enablePan, true);
  assert.equal(fixture.controls.enableDamping, true);
});

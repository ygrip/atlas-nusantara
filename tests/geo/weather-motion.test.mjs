import assert from 'node:assert/strict';
import test from 'node:test';
import { weatherActivity } from '../../src/lib/map/weather-motion.ts';

function field(values = {}) {
  return { width: 2, height: 1, u: new Float32Array(2), v: new Float32Array(2), cloud: new Float32Array(2), rain: new Float32Array(2), thunder: [], meanU: 0, meanV: 0, ...values };
}

for (const scenario of [
  { name: 'empty forecast is static', current: field(), next: field(), mix: 0, expected: { cloud: false, rain: false, wind: false } },
  { name: 'opposing winds still animate', current: field({ u: new Float32Array([5, -5]) }), next: field(), mix: 0, expected: { cloud: false, rain: false, wind: true } },
  { name: 'inactive future forecast costs no frames', current: field(), next: field({ cloud: new Float32Array([1, 1]) }), mix: 0, expected: { cloud: false, rain: false, wind: false } },
  { name: 'blended future rain animates', current: field(), next: field({ rain: new Float32Array([0, 1]) }), mix: 0.5, expected: { cloud: false, rain: true, wind: false } },
  { name: 'completed blend ignores old storms', current: field({ thunder: [{ x: 1, y: 1 }] }), next: field(), mix: 1, expected: { cloud: false, rain: false, wind: false } }
]) {
  test(scenario.name, () => assert.deepEqual(weatherActivity(scenario.current, scenario.next, scenario.mix), scenario.expected));
}

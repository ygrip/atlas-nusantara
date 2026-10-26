import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePointOverlay } from '../../src/lib/map/overlay-contract.ts';

function fixture() {
  return { id: 'mountains', color: '#789156', symbol: 'triangle', source: 'Test fixture only', fetchedAt: '2026-10-26T12:00:00Z', legend: [{ label: 'Test mountains', color: '#789156', symbol: 'triangle' }], pins: [{ id: 'fixture', label: 'Synthetic test point', lat: -6, lon: 107, value: 2500 }] };
}

for (const symbol of ['circle', 'triangle', 'diamond']) {
  test(`a future point layer can use the ${symbol} symbol without changing the renderer`, () => {
    assert.equal(validatePointOverlay({ ...fixture(), symbol }), true);
  });
}
for (const [name, change] of [
  ['invalid coordinates', overlay => { overlay.pins[0].lat = 100; }],
  ['duplicate identities', overlay => { overlay.pins.push({ ...overlay.pins[0] }); }],
  ['unsafe colour', overlay => { overlay.color = 'url(https://example.com)'; }],
  ['missing timestamp', overlay => { overlay.fetchedAt = ''; }],
  ['unknown symbol', overlay => { overlay.symbol = 'script'; }]
]) {
  test(`overlay contract rejects ${name}`, () => {
    const overlay = fixture();
    change(overlay);
    assert.equal(validatePointOverlay(overlay), false);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeferredAtlasAsset, isValidShellAssetList } from '../../src/lib/pwa/cache-policy.ts';

for (const [path, deferred] of [
  ['/og/nusantara.png', true],
  ['/og/nusantara-id.png', true],
  ['/data/flora/index.json', true],
  ['/data/fauna/provinces/35.json', true],
  ['/data/cuisine/index.json', true],
  ['/data/cuisine/locales/id.json', true],
  ['/_app/immutable/chunks/lazy.js', false],
  ['/data/geometry-2025/regions.json', false],
  ['/data/admin-2025/cities/35.json', false],
  ['/data/destinations/provinces/35.json', true],
  ['/data/destinations/v1.json', true],
  ['/data/destinations/national.json', true],
  ['/data/destinations/image-metadata.json', true],
  ['/data/observations/mountains.json', true],
  ['/data/observations/population-regions/35.json', true],
  ['/data/destinations/index.json', false],
  ['/icon-192.png', false]
]) {
  test(`installation cache policy for ${path}`, () => {
    assert.equal(isDeferredAtlasAsset(path), deferred);
  });
}

for (const [assets, valid] of [
  [['/_app/immutable/entry/start.js', '/200.html'], true],
  [['/200.html'], true],
  [[], false],
  [null, false],
  [{ assets: ['/200.html'] }, false],
  [['/200.html', '/200.html'], false],
  [['//evil.example/script.js', '/200.html'], false],
  [['https://example.com/a.js', '/200.html'], false],
  [['/api/archive', '/200.html'], false],
  [['/%61pi/archive', '/200.html'], false],
  [['/data/snapshots/weather.json', '/200.html'], false],
  [['/data/published/manifest.json', '/200.html'], false],
  [['/assets/%2e%2e/secret', '/200.html'], false],
  [['/assets/../secret', '/200.html'], false],
  [['/assets\\\\secret', '/200.html'], false],
  [['/file.js?download=1', '/200.html'], false],
  [['/file.js#fragment', '/200.html'], false],
  [['/x'.repeat(2049), '/200.html'], false],
  [[...Array.from({ length: 256 }, (_, index) => '/asset-' + index), '/200.html'], false],
  [['/index.html'], false]
]) {
  let outcome = 'rejects';
  if (valid) outcome = 'accepts';
  test(`shell asset manifest validation: ${outcome} ${String(assets).slice(0, 50)}`, () => {
    assert.equal(isValidShellAssetList(assets), valid);
  });
}

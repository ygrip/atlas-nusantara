import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeferredAtlasAsset } from '../../src/lib/pwa/cache-policy.ts';

for (const [path, deferred] of [
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

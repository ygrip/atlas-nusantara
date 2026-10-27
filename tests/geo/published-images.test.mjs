import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDestinationPhoto, validateDestinationCatalog } from '../../src/lib/data/destination-contract.ts';
import { applyImageRegistry } from '../../scripts/destinations/image-publication.mjs';

const directory = new URL('../../static/data/destinations/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', directory), 'utf8'));
const registry = JSON.parse(readFileSync(new URL('image-metadata.json', directory), 'utf8'));
const shards = Object.fromEntries(index.provinces.map(summary => [summary.provinceCode,
  JSON.parse(readFileSync(new URL('provinces/' + summary.provinceCode + '.json', directory), 'utf8'))]));

test('static national JSON contains exactly the province records and credited images', () => {
  const national = JSON.parse(readFileSync(new URL('national.json', directory), 'utf8'));
  const places = Object.values(shards).flatMap(shard => shard.landmarks);
  assert.equal(validateDestinationCatalog(national), true);
  assert.equal(national.countryCode, 'ID');
  assert.equal(national.landmarks.length, index.coverage.totalRecords);
  assert.deepEqual(new Set(national.landmarks.map(place => place.id)), new Set(places.map(place => place.id)));
  assert.equal(national.landmarks.filter(place => place.image).length, index.coverage.licensedImages);
});

test('all published photos have runtime-safe metadata, creator credits, and revalidated location/license evidence', () => {
  const places = Object.values(shards).flatMap(shard => shard.landmarks);
  const images = places.filter(place => place.image);
  assert.equal(images.length, index.coverage.licensedImages);
  assert.equal(images.length, registry.entries.length);
  assert.equal(registry.coverage.evaluatedDestinations, places.length);
  for (const place of images) assert.equal(validateDestinationPhoto(place.image), true, place.id);
  const result = applyImageRegistry(structuredClone(index), structuredClone(shards), registry);
  assert.deepEqual(result, { published: images.length, rejected: 0, missingDestinations: 0 });
});

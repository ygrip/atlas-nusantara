import test from 'node:test';
import assert from 'node:assert/strict';
import { applyImageRegistry, destinationFingerprint, IMAGE_REVIEW_POLICY } from '../../scripts/destinations/image-publication.mjs';

const retrievedAt = '2026-01-18T12:00:00.000Z';
const place = { id: 'sisparnas-123', name: 'Air Terjun Sri Gethuk', provinceCode: '34', lat: -7.9465, lon: 110.4897 };
const subject = { id: 'Q123456', labels: ['Air Terjun Sri Gethuk'], lat: -7.9465, lon: 110.4897,
  imageTitle: 'File:Sri Gethuk waterfall.jpg' };
const image = { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Sri_Gethuk.jpg/640px-Sri_Gethuk.jpg',
  descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Sri_Gethuk_waterfall.jpg', credit: 'Photographer',
  license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', reviewedAt: retrievedAt };

function registryEntry(destination = place, changes = {}) {
  return {
    destinationId: destination.id,
    destinationFingerprint: destinationFingerprint(destination),
    subject: structuredClone(subject),
    locationEvidence: {
      method: 'exact-name-and-subject-coordinate', verification: 'automated', subjectId: subject.id,
      matchedLabel: subject.labels[0], distanceMeters: 0, subjectLat: subject.lat, subjectLon: subject.lon,
      sourceUrl: 'https://www.wikidata.org/wiki/Q123456'
    },
    image: structuredClone(image),
    licenseEvidence: {
      fileTitle: subject.imageTitle, requestedTitle: subject.imageTitle, pageId: 98765,
      fileTimestamp: '2025-06-01T10:20:30Z', fileSha1: '0123456789abcdef0123456789abcdef01234567',
      metadataRetrievedAt: retrievedAt, licenseMetadataUrl: image.licenseUrl, creator: image.credit, attribution: '',
      licenseReview: 'commons-file-metadata-v1'
    },
    ...changes
  };
}

function catalog() {
  const index = { coverage: { licensedImages: 0 } };
  const shards = { '34': { landmarks: [structuredClone(place)] } };
  return { index, shards, destination: shards['34'].landmarks[0] };
}

function registry(entries, changes = {}) {
  return {
    schemaVersion: 1,
    policy: IMAGE_REVIEW_POLICY,
    discoveredAt: retrievedAt,
    coverage: { evaluatedDestinations: 1 },
    entries,
    ...changes
  };
}

test('publisher stores a photo only with exact-name location and Commons license evidence', () => {
  const { index, shards, destination } = catalog();
  const result = applyImageRegistry(index, shards, registry([registryEntry()]));
  assert.deepEqual(result, { published: 1, rejected: 0, missingDestinations: 0 });
  assert.deepEqual(destination.image, image);
  assert.equal(index.coverage.licensedImages, 1);
  assert.equal(index.imageEnrichment.publishedImages, 1);
  assert.equal(index.imageEnrichment.evaluatedDestinations, 1);
});

for (const [name, mutate] of [
  ['destination fingerprint drift', (entry, destination) => { destination.lat += 0.01; }],
  ['tampered license URL', entry => { entry.image.licenseUrl = 'https://example.org/license'; }],
  ['tampered license evidence', entry => { entry.licenseEvidence.licenseMetadataUrl = 'https://example.org/license'; }],
  ['tampered creator credit', entry => { entry.image.credit = 'Different photographer'; }],
  ['tampered matched label', entry => { entry.locationEvidence.matchedLabel = 'Different place'; }],
  ['tampered proof latitude', entry => { entry.locationEvidence.subjectLat += 1; }],
  ['tampered proof URL', entry => { entry.locationEvidence.sourceUrl = 'https://example.org/'; }],
  ['coordinate proof drift', entry => { entry.subject.lat += 0.01; }],
  ['missing location distance', entry => { delete entry.locationEvidence.distanceMeters; }],
  ['non-numeric location distance', entry => { entry.locationEvidence.distanceMeters = '0'; }],
  ['location evidence distance tampering', entry => { entry.locationEvidence.distanceMeters = 500; }],
  ['wrong requested file title', entry => { entry.licenseEvidence.requestedTitle = 'File:Different.jpg'; }],
  ['wrong Wikidata subject identity', entry => { entry.locationEvidence.subjectId = 'Q999'; }]
]) {
  test(`publisher rejects ${name} and removes any stale image`, () => {
    const { index, shards, destination } = catalog();
    destination.image = structuredClone(image);
    const entry = registryEntry();
    mutate(entry, destination);
    const result = applyImageRegistry(index, shards, registry([entry]));
    assert.deepEqual(result, { published: 0, rejected: 1, missingDestinations: 0 });
    assert.equal(destination.image, undefined);
    assert.equal(index.coverage.licensedImages, 0);
  });
}

test('publisher recounts licensed images and reports registry entries for absent destinations', () => {
  const { index, shards } = catalog();
  const absent = { ...place, id: 'sisparnas-absent' };
  const result = applyImageRegistry(index, shards, registry([registryEntry(), registryEntry(absent)]));
  assert.deepEqual(result, { published: 1, rejected: 0, missingDestinations: 1 });
  assert.equal(index.coverage.licensedImages, 1);
  assert.equal(index.imageEnrichment.missingDestinations, 1);
});

test('publisher fails on duplicate destination IDs in the registry', () => {
  const { index, shards } = catalog();
  assert.throws(() => applyImageRegistry(index, shards,
    registry([registryEntry(), registryEntry()])), /Duplicate destination/);
});

test('an absent registry does not overwrite index or shard data', () => {
  const { index, shards, destination } = catalog();
  destination.image = structuredClone(image);
  const originalIndex = structuredClone(index);
  const originalShards = structuredClone(shards);
  assert.deepEqual(applyImageRegistry(index, shards, undefined), { published: 0, rejected: 0 });
  assert.deepEqual(index, originalIndex);
  assert.deepEqual(shards, originalShards);
});

test('publishes two independently licensed photos as an ordered gallery while preserving legacy image', () => {
  const { index, shards, destination } = catalog();
  const first = registryEntry();
  const second = registryEntry();
  second.image = { ...second.image, url: 'https://upload.wikimedia.org/second.jpg',
    descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Second.jpg', credit: 'Another photographer' };
  second.subject.imageTitle = 'File:Second.jpg';
  second.licenseEvidence = { ...second.licenseEvidence, fileTitle: 'File:Second.jpg',
    requestedTitle: 'File:Second.jpg', creator: 'Another photographer' };
  const entry = { ...first, photos: [first, second] };
  const result = applyImageRegistry(index, shards, registry([entry]));
  assert.deepEqual(result, { published: 1, rejected: 0, missingDestinations: 0 });
  assert.deepEqual(destination.image, image);
  assert.deepEqual(destination.images, [image, second.image]);
  assert.equal(index.coverage.licensedImages, 1);
  assert.equal(index.coverage.licensedPhotos, 2);
  assert.equal(index.imageEnrichment.publishedPhotos, 2);
});

test('rejects a gallery atomically when another image is unlicensed, stale or duplicate', () => {
  const { index, shards, destination } = catalog();
  const first = registryEntry();
  const tampered = registryEntry();
  tampered.image = { ...image, credit: 'Wrong credit' };
  const entry = { ...first, photos: [first, tampered] };
  const result = applyImageRegistry(index, shards, registry([entry]));
  assert.deepEqual(result, { published: 0, rejected: 1, missingDestinations: 0 });
  assert.equal(destination.image, undefined);
  assert.equal(destination.images, undefined);
});

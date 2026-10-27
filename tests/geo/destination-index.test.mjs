import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDestinationIndex } from '../../src/lib/data/destination-index.ts';
import { validateDestinationCatalog, validateDestinationPhoto } from '../../src/lib/data/destination-contract.ts';
import { verifyCommonsPhoto } from '../../scripts/destinations/image-license.mjs';

const directory = new URL('../../static/data/destinations/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', directory), 'utf8'));

test('published destination index and all lazy shards agree', () => {
  assert.equal(validateDestinationIndex(index), true);
  let count = 0;
  for (const summary of index.provinces) {
    const shard = JSON.parse(readFileSync(new URL('provinces/' + summary.provinceCode + '.json', directory), 'utf8'));
    assert.equal(validateDestinationCatalog(shard), true);
    assert.equal(shard.landmarks.length, summary.count);
    assert.equal(shard.landmarks.every(place => place.provinceCode === summary.provinceCode), true);
    count += shard.landmarks.length;
  }
  assert.equal(count, index.coverage.totalRecords);
});

for (const [name, change] of [
  ['duplicate province', value => { value.provinces[1] = value.provinces[0]; }],
  ['unsafe national URL', value => { value.national = 'https://example.org/catalog'; }],
  ['unsafe shard URL', value => { value.provinces[0].shard = 'https://example.org/shard'; }],
  ['wrong total', value => { value.coverage.totalRecords++; }],
  ['unavailable coverage misreported', value => { value.coverage.sourceCoveragePercent = -1; }]
]) {
  test(`index rejects ${name}`, () => {
    const value = structuredClone(index);
    change(value);
    assert.equal(validateDestinationIndex(value), false);
  });
}

for (const license of ['All rights reserved', 'CC BY-NC 4.0', 'Unknown']) {
  test(`unapproved photo license ${license} cannot be published`, () => {
    const photo = { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/example.jpg',
      descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg', credit: 'Photographer',
      license, licenseUrl: 'https://example.org/license', reviewedAt: '2026-10-27T00:00:00Z' };
    assert.equal(validateDestinationPhoto(photo), false);
    assert.equal(verifyCommonsPhoto({ imageinfo: [{ thumburl: photo.url, descriptionurl: photo.descriptionUrl,
      extmetadata: { LicenseShortName: { value: license }, Artist: { value: photo.credit }, LicenseUrl: { value: photo.licenseUrl } } }] }, '2026-10-27T00:00:00Z'), undefined);
  });
}

test('a photo URL and credit alone do not qualify as reviewed image metadata', () => {
  assert.equal(validateDestinationPhoto({ url: 'https://example.org/image.jpg', credit: 'Example' }), false);
});

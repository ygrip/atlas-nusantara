import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCommonsFileToDestination } from '../../scripts/destinations/image-matching.mjs';
import { candidatesFromCommonsSearch, searchUrl } from '../../scripts/destinations/fill-commons-photos.mjs';
import { discoveryLinks, buildImageReviewQueue } from '../../scripts/destinations/image-review-queue.mjs';
import { registrySubjects, loadCommonsCategoryMembers } from '../../scripts/destinations/image-discovery.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const place = { id: 'sisparnas-1', name: 'Bunker Kaliadem Merapi', provinceCode: '34',
  lat: -7.5829145, lon: 110.4451067, sourceDistrict: 'Kabupaten Sleman', sourceProvince: 'DI Yogyakarta' };

test('only exact distinctive filenames with nearby file-page geotags are eligible', () => {
  const matching = matchCommonsFileToDestination(place, 'File:Bunker Kaliadem Merapi.jpg',
    { lat: -7.5829, lon: 110.4451 });
  assert.equal(matching?.method, 'commons-file-title-and-nearby-geotag');
  assert.equal(matching?.fileTitle, 'File:Bunker Kaliadem Merapi.jpg');
  assert.equal(matchCommonsFileToDestination(place, 'File:Merapi sunrise.jpg',
    { lat: -7.5829, lon: 110.4451 }), undefined);
  assert.equal(matchCommonsFileToDestination(place, 'File:Bunker Kaliadem Merapi.jpg',
    { lat: -7.7, lon: 110.4451 }), undefined);
  assert.equal(matchCommonsFileToDestination({ ...place, name: 'Pantai' },
    'File:Pantai in Indonesia.jpg', { lat: -7.5829, lon: 110.4451 }), undefined);
});

test('search results are only candidates when independently geotagged to the named place', () => {
  const url = new URL(searchUrl(place.name));
  assert.equal(url.hostname, 'commons.wikimedia.org');
  assert.equal(url.searchParams.get('gsrnamespace'), '6');
  const found = candidatesFromCommonsSearch(place, { query: { pages: {
    1: { ns: 6, title: 'File:Bunker Kaliadem Merapi.jpg',
      coordinates: [{ lat: -7.5829, lon: 110.4451 }] },
    2: { ns: 6, title: 'File:Bunker Kaliadem Merapi far away.jpg',
      coordinates: [{ lat: -6.5, lon: 110.4451 }] },
    3: { ns: 6, title: 'File:Other waterfall.jpg',
      coordinates: [{ lat: -7.5829, lon: 110.4451 }] }
  } } });
  assert.equal(found.length, 1);
  assert.equal(found[0].fileTitle, 'File:Bunker Kaliadem Merapi.jpg');
});

test('Wikidata-only Commons categories remain eligible even without a featured P18', () => {
  const row = {
    item: { value: 'http://www.wikidata.org/entity/Q123' },
    label: { value: 'Bunker Kaliadem Merapi' },
    coordinates: { value: 'Point(110.4451067 -7.5829145)' },
    category: { value: 'Bunker Kaliadem' }
  };
  const result = registrySubjects([row]);
  assert.equal(result.subjects.length, 1);
  assert.deepEqual(result.subjects[0].commonsCategories, ['Bunker Kaliadem']);
  assert.deepEqual(result.subjects[0].imageTitles, []);
});

test('Commons category queries collect direct File: members only', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'atlas-commons-categories-'));
  const fetcher = async url => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('cmnamespace'), '6');
    return Response.json({ query: { categorymembers: [
      { title: 'File:Destination front.jpg', ns: 6 },
      { title: 'Category:Near destination', ns: 14 },
      { title: 'File:Destination plaza.jpg', ns: 6 }
    ] } });
  };
  try {
    const result = await loadCommonsCategoryMembers(['Destination name'], dir, { fetcher, delayMs: 0 });
    assert.deepEqual(result.get('Destination name'), ['File:Destination front.jpg', 'File:Destination plaza.jpg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('review links include Google and Commons without turning search links into published photos', async () => {
  const links = discoveryLinks(place);
  assert.equal(new URL(links.googleImages).hostname, 'www.google.com');
  assert.equal(new URL(links.wikimediaCommons).hostname, 'commons.wikimedia.org');
  assert.ok(links.googleImages.includes('Bunker+Kaliadem'));
  const review = await buildImageReviewQueue({ province: '34', limit: 3 });
  assert.equal(review.length, 3);
  assert.ok(review.every(item => item.provinceCode === '34' && item.requiresReview === true));
  assert.ok(review.every(item => !Object.hasOwn(item, 'image')));
});

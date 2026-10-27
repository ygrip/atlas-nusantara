import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  wikipediaSearchUrl, wikipediaArticleFiles, relevantWikipediaArticleFile,
  selectWikipediaArticle, discoverWikipediaPhotos
} from '../../scripts/destinations/search-wikipedia-images.mjs';
import { matchWikipediaArticleToDestination } from '../../scripts/destinations/image-matching.mjs';
import { IMAGE_REVIEW_POLICY } from '../../scripts/destinations/image-publication.mjs';

const place = {
  id: 'sisparnas-24702', officialId: '24702', provinceCode: '34',
  name: 'Air Terjun Sri Gethuk', kind: 'unknown',
  sourceUrl: 'https://sisparnas.kemenpar.go.id/datapanel',
  sourceDistrict: 'Kabupaten Gunung Kidul',
  sourceProvince: 'DI Yogyakarta', lat: -7.9428574, lon: 110.4871372
};
const article = {
  pageid: 12345, ns: 0, title: 'Air Terjun Sri Gethuk',
  coordinates: [{ lat: place.lat, lon: place.lon }],
  pageimage: 'Sri Gethuk.jpg',
  images: [{ ns: 6, title: 'File:Sri Gethuk.jpg' },
    { ns: 6, title: 'File:Diagram.svg' }]
};
const photo = {
  pageid: 9876, title: 'File:Sri Gethuk.jpg', imagerepository: 'local',
  imageinfo: [{
    mime: 'image/jpeg', mediatype: 'BITMAP',
    thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Sri_Gethuk.jpg/640px-Sri_Gethuk.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Sri_Gethuk.jpg',
    sha1: '0123456789abcdef0123456789abcdef01234567',
    timestamp: '2026-01-01T10:00:00Z',
    extmetadata: {
      LicenseShortName: { value: 'CC BY 4.0' },
      LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
      Artist: { value: 'Destination Photographer' }
    }
  }]
};

test('Wikipedia search uses Indonesian or English wiki, never nationwide Wikidata pagination', () => {
  const url = new URL(wikipediaSearchUrl(place.name, 'id'));
  assert.equal(url.hostname, 'id.wikipedia.org');
  assert.equal(url.searchParams.get('gsrsearch'), place.name);
  assert.equal(url.searchParams.get('prop'), 'coordinates|pageimages|images');
  assert.equal(url.searchParams.get('gsrnamespace'), '0');
  assert.equal(url.searchParams.get('pilicense'), 'free');
  assert.equal(new URL(wikipediaSearchUrl(place.name, 'en')).hostname, 'en.wikipedia.org');
  assert.throws(() => wikipediaSearchUrl(place.name, 'de'));
});

test('article match requires exact distinctive name and nearby independent coordinates', () => {
  const good = matchWikipediaArticleToDestination(place, article, 'id');
  assert.equal(good?.method, 'wikipedia-exact-article-and-coordinate');
  assert.ok(good.sourceUrl.startsWith('https://id.wikipedia.org/wiki/'));
  assert.equal(selectWikipediaArticle(place, [article], 'id')?.page.title, article.title);
  assert.equal(selectWikipediaArticle(place, [article, { ...article, pageid: 456 }], 'id'), undefined);
  assert.equal(matchWikipediaArticleToDestination(place, { ...article, title: 'Air Terjun Lain' }, 'id'), undefined);
  assert.equal(matchWikipediaArticleToDestination(place, { ...article, coordinates: [] }, 'id'), undefined);
  assert.equal(matchWikipediaArticleToDestination(place, {
    ...article, coordinates: [{ lat: -6.3, lon: 110.48 }]
  }, 'id'), undefined);
  assert.equal(matchWikipediaArticleToDestination({ ...place, lat: undefined }, article, 'id'), undefined);
});

test('only place-related secondary article photos are eligible for galleries', () => {
  assert.equal(relevantWikipediaArticleFile(place, article, 'File:Sri Gethuk.jpg'), true);
  assert.equal(relevantWikipediaArticleFile(place, article, 'File:Panorama Gethuk.jpg'), true);
  assert.equal(relevantWikipediaArticleFile(place, article, 'File:Flag Indonesia.png'), false);
  assert.equal(relevantWikipediaArticleFile(place, article, 'File:Yogyakarta Province Map.jpg'), false);
  assert.equal(relevantWikipediaArticleFile(place, article, 'File:Different waterfall.jpg'), false);
});

test('article images prioritize lead photo, dedupe and exclude non-bitmaps', () => {
  assert.deepEqual(wikipediaArticleFiles(article), ['File:Sri Gethuk.jpg']);
  assert.deepEqual(wikipediaArticleFiles({
    ...article, pageimage: undefined,
    images: [{ ns: 6, title: 'File:Alternative.png' },
      { ns: 6, title: 'File:Alternative.png' }, { ns: 6, title: 'File:Map.svg' }]
  }), ['File:Alternative.png']);
});

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'atlas-wikipedia-'));
  const catalogDirectory = path.join(root, 'destinations');
  const cacheDirectory = path.join(root, 'cache');
  try {
    await mkdir(path.join(catalogDirectory, 'provinces'), { recursive: true });
    const codes = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36',
      '51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82',
      '91','92','93','94','95','96'];
    const provinces = codes.map(code => ({
      provinceCode: code, count: code === '34' ? 1 : 0,
      natural: 0, built: 0, unknown: code === '34' ? 1 : 0,
      shard: '/data/destinations/provinces/' + code + '.json'
    }));
    const base = {
      fetchedAt: '2026-10-26T00:00:00Z',
      source: 'SISPARNAS',
      sourceUrl: 'https://sisparnas.kemenpar.go.id/datapanel',
      scope: 'Fixture from one region'
    };
    const index = {
      ...base, schemaVersion: 2, provinces, license: 'Metadata only',
      attribution: 'SISPARNAS',
      coverage: { totalRecords: 1, licensedImages: 0,
        geocodedRecords: 1, classifiedRecords: 0, sourceCoveragePercent: null }
    };
    await writeFile(path.join(catalogDirectory, 'index.json'), JSON.stringify(index));
    for (const province of provinces) {
      await writeFile(path.join(catalogDirectory, 'provinces', province.provinceCode + '.json'),
        JSON.stringify({
          ...base, schemaVersion: 1, codeEdition: '2025',
          provinceCode: province.provinceCode,
          retrievedAt: base.fetchedAt,
          landmarks: province.provinceCode === '34' ? [place] : []
        }));
    }
    await writeFile(path.join(catalogDirectory, 'image-metadata.json'), JSON.stringify({
      schemaVersion: 1, policy: IMAGE_REVIEW_POLICY,
      discoveredAt: '2026-01-01T00:00:00Z',
      coverage: { evaluatedDestinations: 1, licensedImages: 0 }, entries: []
    }));
    await run({ catalogDirectory, cacheDirectory });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('Wikipedia discovery publishes verified Commons image while preserving attribution', async () => {
  await fixture(async ({ catalogDirectory, cacheDirectory }) => {
    const fetcher = async url => {
      const host = new URL(url).hostname;
      if (host === 'id.wikipedia.org')
        return Response.json({ query: { pages: [article] } });
      if (host === 'commons.wikimedia.org')
        return Response.json({ query: { pages: { 1: photo } } });
      throw Error('Unexpected origin: ' + host);
    };
    const first = await discoverWikipediaPhotos({
      catalogDirectory, cacheDirectory, province: '34', publish: true,
      delayMs: 0, pause: async () => {}, fetcher
    });
    assert.equal(first.scanned, 1);
    assert.equal(first.newPhotos, 1);
    assert.equal(first.newDestinations, 1);
    assert.equal(first.published, true);
    const province = JSON.parse(await readFile(path.join(catalogDirectory, 'provinces', '34.json'), 'utf8'));
    assert.equal(province.landmarks[0].image.credit, 'Destination Photographer');
    assert.equal(province.landmarks[0].image.license, 'CC-BY-4.0');
    const metadata = JSON.parse(await readFile(path.join(catalogDirectory, 'image-metadata.json'), 'utf8'));
    assert.equal(metadata.entries[0].locationEvidence.method, 'wikipedia-exact-article-and-coordinate');
    const reviews = await readFile(path.join(cacheDirectory, 'wikipedia-review.jsonl'), 'utf8');
    assert.match(reviews, /verified-images/);
  });
});

test('Wikipedia discovery leaves coordinate-free matches for manual review', async () => {
  await fixture(async ({ catalogDirectory, cacheDirectory }) => {
    let commonsCalls = 0;
    const fetcher = async url => {
      if (new URL(url).hostname === 'commons.wikimedia.org') {
        commonsCalls++;
        throw Error('Unmatched article should not request Commons metadata');
      }
      return Response.json({ query: { pages: [{ ...article, coordinates: [] }] } });
    };
    const result = await discoverWikipediaPhotos({
      catalogDirectory, cacheDirectory, province: '34', publish: true,
      delayMs: 0, pause: async () => {}, fetcher
    });
    assert.equal(result.newPhotos, 0);
    assert.equal(result.published, false);
    assert.equal(commonsCalls, 0);
    const review = JSON.parse((await readFile(result.reviewFile, 'utf8')).trim());
    assert.equal(review.status, 'no-verified-article');
    assert.ok(review.candidateArticles.length > 0);
  });
});

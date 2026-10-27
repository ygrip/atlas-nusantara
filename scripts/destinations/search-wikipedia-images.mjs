/**
 * Destination-first Wikipedia photo discovery.
 * Article matches require a distinctive exact title and matching coordinates.
 * Wikimedia Commons metadata supplies actual image-license evidence.
 *
 * Usage:
 *   npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --province=34 --publish
 *   npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --limit=100
 *   npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --after=sisparnas-123 --limit=100
 *   npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --output=/tmp/wiki-review.jsonl
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { CrawlClient } from './crawl-http.mjs';
import { loadDestinationCatalog, publishImageRegistry } from './enrich-images.mjs';
import { loadCommonsPages } from './image-discovery.mjs';
import { matchWikipediaArticleToDestination, normalizeName } from './image-matching.mjs';
import { verifyCommonsPhoto } from './image-license.mjs';
import { applyImageRegistry, destinationFingerprint, IMAGE_REVIEW_POLICY, readImageRegistry } from './image-publication.mjs';

const CATALOG_DIRECTORY = fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));
const MAX_PHOTOS = 8;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function wikipediaSearchUrl(name, language) {
  if (!['id', 'en'].includes(language)) throw Error('Unsupported Wikipedia language');
  const query = name.replace(/["\\]/g, ' ').trim();
  return 'https://' + language + '.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrsearch: query, gsrnamespace: '0', gsrlimit: '10',
    prop: 'coordinates|pageimages|images', colimit: '10', imlimit: '40',
    piprop: 'name', pilicense: 'free', maxlag: '5'
  });
}

export function wikipediaArticleFiles(page) {
  const list = [];
  const lead = typeof page.pageimage === 'string' ? page.pageimage : '';
  if (lead) list.push(lead.startsWith('File:') ? lead : 'File:' + lead);
  for (const image of page.images ?? []) {
    if (image?.ns === 6 && typeof image.title === 'string') list.push(image.title);
  }
  return [...new Set(list)]
    .filter(title => /^File:.+\.(?:jpe?g|png|webp)$/i.test(title))
    .slice(0, 40);
}

/** The lead image is curated by Wikipedia. Other article illustrations can be
 * region maps/logos, so require distinctive destination tokens in their name. */
export function relevantWikipediaArticleFile(place, page, fileTitle) {
  const lead = typeof page.pageimage === 'string'
    ? (page.pageimage.startsWith('File:') ? page.pageimage : 'File:' + page.pageimage)
    : undefined;
  if (fileTitle === lead) return true;
  const filename = normalizeName(fileTitle.slice('File:'.length).replace(/\.[^.]+$/, ''));
  if (/\b(?:map|peta|logo|icon|flag|bendera|locator)\b/.test(filename)) return false;
  const ignored = new Set(['air', 'terjun', 'pantai', 'gunung', 'danau', 'taman',
    'wisata', 'candi', 'goa', 'gua', 'pulau', 'museum', 'alam', 'nasional', 'desa',
    'sungai', 'waduk', 'masjid', 'kampung', 'objek', 'obyek']);
  const distinctive = normalizeName(place.name).split(' ').filter(word => word.length >= 4 && !ignored.has(word));
  const fileTokens = new Set(filename.split(' '));
  return distinctive.length > 0 && distinctive.every(token => fileTokens.has(token));
}

export function selectWikipediaArticle(place, pages, language) {
  const matches = (pages ?? []).map(page => ({
    page, evidence: matchWikipediaArticleToDestination(place, page, language)
  })).filter(value => value.evidence);
  // Two competing article identities matching the same landmark means review.
  if (matches.length !== 1) return undefined;
  return matches[0];
}

async function wikipediaPages(client, name, language) {
  const url = wikipediaSearchUrl(name, language);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await client.get(url);
    const payload = JSON.parse(response.body);
    if (!payload.error) {
      if (payload.query && payload.query.pages && !Array.isArray(payload.query.pages))
        throw Error('Unexpected Wikipedia page result');
      return payload.query?.pages ?? [];
    }
    if (!['maxlag', 'ratelimited', 'readonly'].includes(payload.error.code) || attempt === 3)
      throw Error('Wikipedia API error: ' + payload.error.code + ': ' + payload.error.info);
    await client.evictGet(url);
    await client.pause(5000 * (attempt + 1));
  }
  throw Error('Wikipedia retry limit reached');
}

async function saveReview(filename, records) {
  await mkdir(path.dirname(filename), { recursive: true });
  const content = records.map(record => JSON.stringify(record)).join('\n');
  await writeFile(filename + '.partial', content + (content ? '\n' : ''));
  const { rename } = await import('node:fs/promises');
  await rename(filename + '.partial', filename);
}

/**
 * This process is read-only without --publish. Uncertain matches remain
 * in the JSONL review file and can be searched manually.
 */
export async function discoverWikipediaPhotos({
  catalogDirectory = CATALOG_DIRECTORY, cacheDirectory, province, after, limit = Infinity,
  publish = false, output, delayMs = 1000, fetcher = fetch, pause = sleep
}) {
  if (!cacheDirectory) throw Error('cacheDirectory is required');
  if (after && typeof after !== 'string') throw Error('Invalid after destination ID');
  if (province && !/^\d{2}$/.test(province)) throw Error('Invalid province code');
  if (!(limit === Infinity || Number.isSafeInteger(limit) && limit > 0))
    throw Error('limit must be a positive integer');
  const reviewFile = output ?? path.join(cacheDirectory, 'wikipedia-review.jsonl');
  const catalog = await loadDestinationCatalog(catalogDirectory);
  if (province && !catalog.index.provinces.some(item => item.provinceCode === province))
    throw Error('Unknown province code: ' + province);
  if (after && !catalog.places.some(place => place.id === after))
    throw Error('Unknown --after destination ID: ' + after);
  const manifest = await readImageRegistry(path.join(catalogDirectory, 'image-metadata.json'));
  if (!manifest || manifest.policy !== IMAGE_REVIEW_POLICY)
    throw Error('Existing image registry required for licensed publishing');
  const existing = new Map(manifest.entries.map(entry => [entry.destinationId, entry]));
  const clients = Object.fromEntries(['id', 'en'].map(language => [language, new CrawlClient({
    origin: 'https://' + language + '.wikipedia.org',
    cacheDirectory: path.join(cacheDirectory, 'wikipedia-' + language + '-http'),
    delayMs, fetcher, pause
  })]));
  const queue = [];
  const reviews = [];
  let afterReached = !after;
  for (const place of catalog.places) {
    if (!afterReached) {
      if (place.id === after) afterReached = true;
      continue;
    }
    if (province && place.provinceCode !== province) continue;
    if (existing.has(place.id) || place.image || place.images?.length) continue;
    if (reviews.length >= limit) break;
    const item = {
      destinationId: place.id, name: place.name, provinceCode: place.provinceCode,
      district: place.sourceDistrict ?? null, province: place.sourceProvince ?? null,
      lat: Number.isFinite(place.lat) ? place.lat : null,
      lon: Number.isFinite(place.lon) ? place.lon : null,
      searches: [], candidateArticles: [], status: 'no-verified-article'
    };
    let selected;
    for (const language of ['id', 'en']) {
      const url = wikipediaSearchUrl(place.name, language);
      item.searches.push(url);
      const pages = await wikipediaPages(clients[language], place.name, language);
      item.candidateArticles.push(...pages.slice(0, 5).map(page => ({
        language, title: page.title, pageId: page.pageid,
        wikipediaUrl: typeof page.title === 'string'
          ? 'https://' + language + '.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'))
          : null
      })));
      const found = selectWikipediaArticle(place, pages, language);
      if (found) {
        selected = { ...found, language };
        break;
      }
    }
    if (selected) {
      item.status = 'article-matched-license-pending';
      item.matchedArticle = selected.evidence.sourceUrl;
      queue.push({ place, selected, review: item });
    }
    reviews.push(item);
    if (reviews.length % 25 === 0) await saveReview(reviewFile, reviews);
    if (reviews.length % 100 === 0)
      console.log('Wikipedia destinations examined:', reviews.length,
        'verified articles:', queue.length);
  }

  const titles = queue.flatMap(({ selected }) => wikipediaArticleFiles(selected.page));
  const metadata = await loadCommonsPages(titles, cacheDirectory, { fetcher, delayMs, pause });
  let newPhotos = 0;
  let newDestinations = 0;
  for (const { place, selected, review } of queue) {
    const photos = [];
    const seen = new Set();
    for (const title of wikipediaArticleFiles(selected.page)) {
      if (!relevantWikipediaArticleFile(place, selected.page, title)) continue;
      const loaded = metadata.get(title);
      const licensed = loaded && verifyCommonsPhoto(loaded.page, loaded.retrievedAt);
      if (!licensed || title !== licensed.evidence.fileTitle || seen.has(title)) continue;
      seen.add(title);
      photos.push({
        locationEvidence: { ...selected.evidence, articleFileTitle: title },
        image: licensed.image,
        licenseEvidence: { ...licensed.evidence, requestedTitle: title }
      });
      if (photos.length >= MAX_PHOTOS) break;
    }
    review.status = photos.length ? 'verified-images' : 'article-matched-no-licensed-commons-photos';
    review.verifiedPhotos = photos.map(photo => ({
      url: photo.image.url, source: photo.image.descriptionUrl,
      credit: photo.image.credit, license: photo.image.license
    }));
    if (!photos.length) continue;
    const lead = photos[0];
    existing.set(place.id, {
      destinationId: place.id, destinationFingerprint: destinationFingerprint(place),
      ...lead, ...(photos.length > 1 ? { photos } : {})
    });
    newPhotos += photos.length;
    newDestinations++;
  }
  await saveReview(reviewFile, reviews);
  const entries = [...existing.values()].sort((a, b) => a.destinationId.localeCompare(b.destinationId));
  const now = new Date().toISOString();
  const registry = {
    ...manifest, discoveredAt: now,
    sources: { ...manifest.sources,
      wikipedia: 'https://id.wikipedia.org/w/api.php and https://en.wikipedia.org/w/api.php' },
    verification: 'Wikipedia article exact name + subject coordinates within 2 km; article-listed files individually checked against Wikimedia Commons licensing metadata.',
    coverage: {
      ...manifest.coverage, evaluatedDestinations: catalog.places.length,
      licensedImages: entries.length,
      licensedPhotos: entries.reduce((total, entry) => total + (entry.photos?.length ?? 1), 0),
      distinctImageFiles: new Set(entries.flatMap(entry =>
        (entry.photos ?? [entry]).map(photo => photo.licenseEvidence.fileTitle))).size,
      withoutPublishedImage: catalog.places.length - entries.length
    }, entries
  };
  if (newPhotos) {
    // Validate the whole manifest before allowing any overwrite of real data.
    const simulated = applyImageRegistry(
      structuredClone(catalog.index), structuredClone(catalog.shards), registry);
    if (simulated.rejected || simulated.missingDestinations)
      throw Error('Image registry failed verification; nothing has been published');
    if (publish) await publishImageRegistry(catalogDirectory, catalog, registry);
  }
  const result = {
    scanned: reviews.length, matchedArticles: queue.length,
    newDestinations, newPhotos, remainingWithoutPhoto: catalog.places.length - entries.length,
    reviewFile, published: publish && newPhotos > 0
  };
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cacheDirectory = args[0];
  if (!cacheDirectory || cacheDirectory.startsWith('--'))
    throw Error('Usage: node scripts/destinations/search-wikipedia-images.mjs <cache-directory> [--province=34] [--limit=100] [--after=sisparnas-123] [--output=/tmp/review.jsonl] [--publish]');
  for (const flag of args.slice(1)) {
    if (flag !== '--publish' && !/^--(province=\d{2}|limit=\d+|after=sisparnas-\d+|output=.+)$/.test(flag))
      throw Error('Unknown option: ' + flag);
  }
  const province = args.find(arg => arg.startsWith('--province='))?.slice('--province='.length);
  const limitText = args.find(arg => arg.startsWith('--limit='))?.slice('--limit='.length);
  const output = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  const after = args.find(arg => arg.startsWith('--after='))?.slice('--after='.length);
  discoverWikipediaPhotos({
    cacheDirectory, province, after, output,
    limit: limitText ? Number(limitText) : Infinity, publish: args.includes('--publish')
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

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
  publish = false, output, language = 'both', delayMs = 1000,
  fetcher = fetch, pause = sleep, logger = console
}) {
  const log = (...values) => logger.log?.(...values);
  const started = Date.now();
  if (!cacheDirectory) throw Error('cacheDirectory is required');
  if (after && typeof after !== 'string') throw Error('Invalid after destination ID');
  if (province && !/^\d{2}$/.test(province)) throw Error('Invalid province code');
  if (!['id', 'en', 'both'].includes(language)) throw Error('Invalid Wikipedia language: ' + language);
  if (!(limit === Infinity || Number.isSafeInteger(limit) && limit > 0))
    throw Error('limit must be a positive integer');
  const reviewFile = output ?? path.join(cacheDirectory, 'wikipedia-review.jsonl');
  log('[wikipedia] Starting destination-first search',
    { province: province ?? 'all', after: after ?? 'start',
      limit: limit === Infinity ? 'all' : limit, language, publish, reviewFile });
  const catalog = await loadDestinationCatalog(catalogDirectory);
  if (province && !catalog.index.provinces.some(item => item.provinceCode === province))
    throw Error('Unknown province code: ' + province);
  const cursor = after ? catalog.places.findIndex(place => place.id === after) : -1;
  if (after && cursor < 0) throw Error('Unknown --after destination ID: ' + after);
  const manifest = await readImageRegistry(path.join(catalogDirectory, 'image-metadata.json'));
  if (!manifest || manifest.policy !== IMAGE_REVIEW_POLICY)
    throw Error('Existing image registry required for licensed publishing');
  const existing = new Map(manifest.entries.map(entry => [entry.destinationId, entry]));
  const pending = catalog.places.slice(cursor + 1).filter(place =>
    (!province || place.provinceCode === province)
    && !existing.has(place.id) && !place.image && !place.images?.length
  ).slice(0, limit);
  const hasCoords = place => Number.isFinite(place.lat) && Number.isFinite(place.lon);
  const noCoordinates = pending.filter(place => !hasCoords(place)).length;
  const languages = language === 'both' ? ['id', 'en'] : [language];
  log('[wikipedia] Loaded', catalog.places.length, 'destinations;', pending.length,
    'selected;', noCoordinates, 'lack coordinates and will not trigger API searches.');
  const clients = Object.fromEntries(languages.map(lang => [lang, new CrawlClient({
    origin: 'https://' + lang + '.wikipedia.org',
    cacheDirectory: path.join(cacheDirectory, 'wikipedia-' + lang + '-http'),
    delayMs, fetcher, pause
  })]));
  const queue = [];
  const reviews = [];
  let apiQueries = 0;
  const startedDestination = Date.now();
  for (const [index, place] of pending.entries()) {
    const prefix = '[wikipedia][' + (index + 1) + '/' + pending.length + ']';
    log(prefix, place.name, '|', place.sourceDistrict ?? '?', '|', place.sourceProvince ?? '?',
      '|', place.id);
    const item = {
      destinationId: place.id, name: place.name, provinceCode: place.provinceCode,
      district: place.sourceDistrict ?? null, province: place.sourceProvince ?? null,
      lat: hasCoords(place) ? place.lat : null, lon: hasCoords(place) ? place.lon : null,
      searches: [], searchResults: [], candidateArticles: [], status: 'no-verified-article'
    };
    let selected;
    if (!hasCoords(place)) {
      item.status = 'skipped-no-verified-destination-coordinates';
      log(prefix, 'SKIP: no verified coordinates; cannot satisfy article location check.');
    } else {
      for (const lang of languages) {
        const url = wikipediaSearchUrl(place.name, lang);
        item.searches.push(url);
        const requestStart = Date.now();
        log(prefix, 'GET', lang + '.wikipedia.org', 'search="' + place.name + '" (API/cache)');
        const pages = await wikipediaPages(clients[lang], place.name, lang);
        apiQueries++;
        const elapsedMs = Date.now() - requestStart;
        const validCount = pages.filter(page =>
          matchWikipediaArticleToDestination(place, page, lang)).length;
        const exactTitles = pages.filter(page =>
          normalizeName(page.title?.replace(/\s+\([^()]+\)$/, '') ?? '') === normalizeName(place.name)).length;
        item.searchResults.push({ language: lang, returned: pages.length,
          exactTitleCandidates: exactTitles, matchingArticles: validCount,
          elapsedMs });
        item.candidateArticles.push(...pages.slice(0, 5).map(page => ({
          language: lang, title: page.title, pageId: page.pageid,
          hasCoordinates: Array.isArray(page.coordinates) && page.coordinates.length > 0,
          wikipediaUrl: typeof page.title === 'string'
            ? 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'))
            : null
        })));
        log(prefix, lang + ':', pages.length, 'results,', exactTitles, 'exact titles,',
          validCount, 'geographically verified;', elapsedMs + 'ms');
        const found = selectWikipediaArticle(place, pages, lang);
        if (found) {
          selected = { ...found, language: lang };
          log(prefix, 'MATCH:', found.evidence.sourceUrl,
            '|', Math.round(found.evidence.distanceMeters), 'm away');
          break;
        }
      }
    }
    if (selected) {
      item.status = 'article-matched-license-pending';
      item.matchedArticle = selected.evidence.sourceUrl;
      queue.push({ place, selected, review: item });
    } else if (hasCoords(place)) {
      log(prefix, 'NO MATCH: Wikipedia title and coordinates did not identify the same destination.');
    }
    reviews.push(item);
    if (reviews.length % 25 === 0) await saveReview(reviewFile, reviews);
    if (reviews.length % 25 === 0) log('[wikipedia] Progress:',
      reviews.length + '/' + pending.length, 'destinations,', queue.length,
      'verified articles,', apiQueries, 'API/cache lookups,',
      Math.round((Date.now() - startedDestination) / 1000) + 's elapsed.');
  }
  await saveReview(reviewFile, reviews);
  const titles = [...new Set(queue.flatMap(({ place, selected }) =>
    wikipediaArticleFiles(selected.page).filter(title =>
      relevantWikipediaArticleFile(place, selected.page, title))))];
  log('[wikipedia] Article search complete:', queue.length, 'verified articles;',
    titles.length, 'relevant distinct Commons file titles to check.');
  const metadata = await loadCommonsPages(titles, cacheDirectory, { fetcher, delayMs, pause });
  log('[wikipedia] Commons returned metadata for', metadata.size, 'of', titles.length, 'file titles.');
  let newPhotos = 0;
  let newDestinations = 0;
  for (const { place, selected, review } of queue) {
    const photos = [];
    const seen = new Set();
    const checks = [];
    for (const title of wikipediaArticleFiles(selected.page)) {
      if (!relevantWikipediaArticleFile(place, selected.page, title)) {
        checks.push({ title, result: 'unrelated-article-illustration' });
        continue;
      }
      const loaded = metadata.get(title);
      if (!loaded) {
        checks.push({ title, result: 'no-commons-file-metadata' });
        continue;
      }
      const licensed = verifyCommonsPhoto(loaded.page, loaded.retrievedAt);
      if (!licensed) {
        checks.push({ title, result: 'unsupported-license-credit-or-image-format' });
        continue;
      }
      if (title !== licensed.evidence.fileTitle) {
        checks.push({ title, result: 'commons-file-title-redirected',
          canonicalTitle: licensed.evidence.fileTitle });
        continue;
      }
      if (seen.has(title)) {
        checks.push({ title, result: 'duplicate' });
        continue;
      }
      seen.add(title);
      checks.push({ title, result: 'verified' });
      photos.push({
        locationEvidence: { ...selected.evidence, articleFileTitle: title },
        image: licensed.image,
        licenseEvidence: { ...licensed.evidence, requestedTitle: title }
      });
      if (photos.length >= MAX_PHOTOS) break;
    }
    review.imageChecks = checks;
    review.status = photos.length ? 'verified-images' : 'article-matched-no-licensed-commons-photos';
    review.verifiedPhotos = photos.map(photo => ({
      url: photo.image.url, source: photo.image.descriptionUrl,
      credit: photo.image.credit, license: photo.image.license
    }));
    log('[wikipedia][photos]', place.name + ':', photos.length, 'verified of',
      checks.length, 'article images;',
      checks.filter(check => check.result !== 'verified')
        .reduce((counts, check) => {
          counts[check.result] = (counts[check.result] ?? 0) + 1; return counts;
        }, {}));
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
  const registry = {
    ...manifest, discoveredAt: new Date().toISOString(),
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
    const simulated = applyImageRegistry(
      structuredClone(catalog.index), structuredClone(catalog.shards), registry);
    if (simulated.rejected || simulated.missingDestinations)
      throw Error('Image registry failed verification; nothing has been published');
    if (publish) {
      log('[wikipedia] Publishing', newPhotos, 'verified photos for', newDestinations, 'destinations...');
      await publishImageRegistry(catalogDirectory, catalog, registry);
    }
  }
  const result = {
    scanned: reviews.length, noCoordinates, apiQueries,
    matchedArticles: queue.length, newDestinations, newPhotos,
    remainingWithoutPhoto: catalog.places.length - entries.length,
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
    reviewFile, published: publish && newPhotos > 0
  };
  log('[wikipedia] DONE:', JSON.stringify(result));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cacheDirectory = args[0];
  if (!cacheDirectory || cacheDirectory.startsWith('--'))
    throw Error('Usage: node scripts/destinations/search-wikipedia-images.mjs <cache-directory> [--province=34] [--limit=100] [--after=sisparnas-123] [--language=id|en|both] [--output=/tmp/review.jsonl] [--publish]');
  for (const flag of args.slice(1)) {
    if (flag !== '--publish' && !/^--(province=\d{2}|limit=\d+|after=sisparnas-\d+|language=(?:id|en|both)|output=.+)$/.test(flag))
      throw Error('Unknown option: ' + flag);
  }
  const province = args.find(arg => arg.startsWith('--province='))?.slice('--province='.length);
  const limitText = args.find(arg => arg.startsWith('--limit='))?.slice('--limit='.length);
  const output = args.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  const after = args.find(arg => arg.startsWith('--after='))?.slice('--after='.length);
  const language = args.find(arg => arg.startsWith('--language='))?.slice('--language='.length) ?? 'both';
  discoverWikipediaPhotos({
    cacheDirectory, province, after, output, language,
    limit: limitText ? Number(limitText) : Infinity, publish: args.includes('--publish')
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

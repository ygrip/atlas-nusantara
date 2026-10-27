/**
 * Offline all-catalog Commons file search for exact name + nearby file geotag.
 * This intentionally never publishes unverified Google search results.
 *
 * Usage:
 *   node scripts/destinations/fill-commons-photos.mjs /tmp/atlas-cache --publish
 *   node scripts/destinations/fill-commons-photos.mjs /tmp/atlas-cache --province=34 --limit=100 --publish
 *
 * The cache stores API responses for resumable, rate-limited research.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { CrawlClient } from './crawl-http.mjs';
import { loadDestinationCatalog, publishImageRegistry } from './enrich-images.mjs';
import { loadCommonsPages, saveJson } from './image-discovery.mjs';
import { matchCommonsFileToDestination } from './image-matching.mjs';
import { verifyCommonsPhoto } from './image-license.mjs';
import { destinationFingerprint, IMAGE_REVIEW_POLICY, applyImageRegistry } from './image-publication.mjs';

const CATALOG_DIRECTORY = fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));
const API = 'https://commons.wikimedia.org/w/api.php';
const MAX_PHOTOS = 8;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function searchUrl(name) {
  const term = name.replace(/["\\]/g, ' ').trim();
  return API + '?' + new URLSearchParams({
    action: 'query', format: 'json',
    generator: 'search', gsrnamespace: '6',
    gsrsearch: 'intitle:"' + term + '"', gsrlimit: '15',
    prop: 'coordinates', colimit: '10', maxlag: '5'
  });
}

export function candidatesFromCommonsSearch(place, payload) {
  if (payload?.error || !payload?.query?.pages) return [];
  const found = new Map();
  for (const page of Object.values(payload.query.pages)) {
    if (typeof page.title !== 'string' || page.ns !== 6) continue;
    for (const coord of page.coordinates ?? []) {
      const evidence = matchCommonsFileToDestination(place, page.title,
        { lat: coord.lat, lon: coord.lon });
      if (evidence && !found.has(page.title)) found.set(page.title, evidence);
    }
  }
  return [...found.values()].sort((a, b) => a.distanceMeters - b.distanceMeters
    || a.fileTitle.localeCompare(b.fileTitle)).slice(0, MAX_PHOTOS);
}

/** Files are never eligible merely because they appear in a search result. */
export async function discoverCommonsNameGeotags({
  catalogDirectory = CATALOG_DIRECTORY, cacheDirectory, province, limit = Infinity,
  delayMs = 1000, fetcher = fetch, pause = sleep, publish = false
}) {
  if (!cacheDirectory) throw Error('cacheDirectory is required');
  if (province && !/^\d{2}$/.test(province)) throw Error('Invalid province');
  if (!(limit === Infinity || Number.isSafeInteger(limit) && limit > 0)) throw Error('Invalid limit');
  const catalog = await loadDestinationCatalog(catalogDirectory);
  const manifestPath = path.join(catalogDirectory, 'image-metadata.json');
  const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (previous.policy !== IMAGE_REVIEW_POLICY) throw Error('Unsupported image review registry');
  const existing = new Map(previous.entries.map(entry => [entry.destinationId, entry]));
  const candidates = [];
  const client = new CrawlClient({ origin: 'https://commons.wikimedia.org',
    cacheDirectory: path.join(cacheDirectory, 'commons-file-search'), delayMs, fetcher, pause });
  let searched = 0;
  let candidatesLocated = 0;
  for (const place of catalog.places) {
    if (province && place.provinceCode !== province) continue;
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    if (searched >= limit) break;
    // Prefer supplementing existing one-photo records over replacing verified photos.
    if ((existing.get(place.id)?.photos?.length ?? (existing.has(place.id) ? 1 : 0)) >= MAX_PHOTOS) continue;
    async function search(name) {
      const response = await client.get(searchUrl(name));
      const payload = JSON.parse(response.body);
      if (payload.error) throw Error('Commons search error for ' + place.name + ': ' + payload.error.code);
      return candidatesFromCommonsSearch(place, payload);
    }
    let matches = await search(place.name);
    // A local Commons title may omit a redundant last word ("Bunker Kaliadem"
    // versus "Bunker Kaliadem Merapi"). Try one conservative shortened phrase.
    if (!matches.length) {
      const words = place.name.trim().split(/\s+/);
      if (words.length >= 3) {
        matches = await search(words.slice(0, -1).join(' '));
      }
    }
    if (matches.length) {
      candidatesLocated += matches.length;
      candidates.push({ place, matches });
    }
    searched++;
    if (searched % 100 === 0) console.log('Commons searches:', searched,
      'places with geotag candidates:', candidates.length);
  }
  const titles = candidates.flatMap(candidate => candidate.matches.map(evidence => evidence.fileTitle));
  const pages = await loadCommonsPages(titles, cacheDirectory, { fetcher, delayMs, pause });
  let newPhotos = 0;
  let newDestinations = 0;
  for (const { place, matches } of candidates) {
    const oldEntry = existing.get(place.id);
    const photos = oldEntry ? (oldEntry.photos ?? [oldEntry]).map(photo => ({
      subject: photo.subject, locationEvidence: photo.locationEvidence, image: photo.image,
      licenseEvidence: photo.licenseEvidence
    })) : [];
    const fileTitles = new Set(photos.map(photo => photo.licenseEvidence.fileTitle));
    for (const evidence of matches) {
      if (photos.length >= MAX_PHOTOS || fileTitles.has(evidence.fileTitle)) continue;
      const response = pages.get(evidence.fileTitle);
      const licensed = response && verifyCommonsPhoto(response.page, response.retrievedAt);
      if (!licensed || fileTitles.has(licensed.evidence.fileTitle)) continue;
      fileTitles.add(licensed.evidence.fileTitle);
      photos.push({
        locationEvidence: evidence,
        image: licensed.image,
        licenseEvidence: { ...licensed.evidence, requestedTitle: evidence.fileTitle }
      });
      newPhotos++;
    }
    if (photos.length <= (oldEntry?.photos?.length ?? (oldEntry ? 1 : 0))) continue;
    if (!oldEntry) newDestinations++;
    const lead = photos[0];
    existing.set(place.id, {
      destinationId: place.id,
      destinationFingerprint: destinationFingerprint(place),
      ...lead,
      ...(photos.length > 1 ? { photos } : {})
    });
  }
  const entries = [...existing.values()].sort((a, b) => a.destinationId.localeCompare(b.destinationId));
  const registry = {
    ...previous,
    policy: IMAGE_REVIEW_POLICY,
    sources: { ...previous.sources, commonsFileSearch: API,
      verification: 'Exact distinctive name in Commons filename and file-page camera geotag <= 350 m' },
    coverage: {
      ...previous.coverage,
      evaluatedDestinations: catalog.places.length,
      licensedImages: entries.length,
      licensedPhotos: entries.reduce((sum, entry) => sum + (entry.photos?.length ?? 1), 0),
      distinctImageFiles: new Set(entries.flatMap(entry =>
        (entry.photos ?? [entry]).map(photo => photo.licenseEvidence.fileTitle))).size,
      withoutPublishedImage: catalog.places.length - entries.length
    },
    verification: 'Automated Wikidata exact-name/location, Commons category membership, or exact filename + nearby camera geotag. Independently reviewed reuse metadata, not human visual verification.',
    entries
  };
  // Validate the complete merged registry, not just new photos, before writing.
  const simulated = applyImageRegistry(structuredClone(catalog.index), structuredClone(catalog.shards), registry);
  if (simulated.rejected || simulated.missingDestinations)
    throw Error('At least one proposed image lacks valid matching evidence; no files published');
  const report = { searched, candidatesLocated, newPhotos, newDestinations, totalWithPhotos: entries.length,
    totalIndividualPhotos: registry.coverage.licensedPhotos,
    remainingWithoutPhoto: catalog.places.length - entries.length };
  await saveJson(path.join(cacheDirectory, 'commons-file-search-report.json'), report);
  if (publish && newPhotos > 0) {
    registry.discoveredAt = new Date().toISOString();
    await publishImageRegistry(catalogDirectory, catalog, registry);
  }
  return { ...report, published: publish && newPhotos > 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cacheDirectory = args[0];
  if (!cacheDirectory || cacheDirectory.startsWith('--')) {
    throw Error('Usage: node scripts/destinations/fill-commons-photos.mjs <cache-directory> [--publish] [--province=34] [--limit=100]');
  }
  for (const flag of args.slice(1)) {
    if (flag !== '--publish' && !/^--(province=\d{2}|limit=\d+)$/.test(flag)) throw Error('Invalid option: ' + flag);
  }
  const province = args.find(a => a.startsWith('--province='))?.split('=')[1];
  const limitText = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitText ? Number(limitText) : Infinity;
  discoverCommonsNameGeotags({ cacheDirectory, province, limit, publish: args.includes('--publish') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}

import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { CrawlClient } from './crawl-http.mjs';

const SPARQL = 'https://query.wikidata.org/sparql';
const LABELS = `?item (rdfs:label|skos:altLabel) ?label.
  FILTER(LANG(?label) = "id" || LANG(?label) = "en")`;
// A place with a Commons category but no featured P18 image is also a candidate.
const SUBJECTS = '?item wdt:P17 wd:Q252; wdt:P625 ?coordinates. OPTIONAL { ?item wdt:P18 ?image. } OPTIONAL { ?item wdt:P373 ?category. }';

export async function saveJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename + '.partial', JSON.stringify(value) + '\n');
  await rename(filename + '.partial', filename);
}

export function commonsFileTitle(value) {
  try {
    const url = new URL(value);
    const prefix = '/wiki/Special:FilePath/';
    if (url.hostname !== 'commons.wikimedia.org' || !['http:', 'https:'].includes(url.protocol)
      || !url.pathname.startsWith(prefix) || url.search || url.hash) return undefined;
    const filename = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/_/g, ' ');
    if (!filename || filename.length > 240 || /[<>\r\n\u0000]/.test(filename)) return undefined;
    return 'File:' + filename;
  } catch { return undefined; }
}

export function registrySubjects(bindings) {
  const groups = new Map();
  for (const row of bindings) {
    const id = row.item?.value?.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/)?.[1];
    const point = row.coordinates?.value?.match(/^Point\((-?[\d.]+)\s+(-?[\d.]+)\)$/);
    const title = commonsFileTitle(row.image?.value);
    const label = row.label?.value;
    const category = row.category?.value;
    const safeCategory = typeof category === 'string' && /^[^\u0000-\u001f<>\[\]{}|"'\u0060]{1,180}$/.test(category) ? category.trim() : undefined;
    if (!id || !point || !(title || safeCategory) || typeof label !== 'string' || !label.trim()) continue;
    const lon = Number(point[1]);
    const lat = Number(point[2]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
    const group = groups.get(id) ?? { id, labels: new Set(), points: new Map(), imageTitles: new Set(), commonsCategories: new Set() };
    group.labels.add(label.trim());
    group.points.set(lon + ',' + lat, { lon, lat });
    if (title) group.imageTitles.add(title);
    if (safeCategory) group.commonsCategories.add(safeCategory);
    groups.set(id, group);
  }
  const subjects = [];
  let ambiguousCoordinates = 0;
  for (const group of groups.values()) {
    if (group.points.size !== 1) { ambiguousCoordinates++; continue; }
    const point = [...group.points.values()][0];
    const imageTitles = [...group.imageTitles].sort();
    subjects.push({ id: group.id, labels: [...group.labels].sort(), lat: point.lat, lon: point.lon,
      imageTitle: imageTitles[0], imageTitles,
      commonsCategories: [...group.commonsCategories].sort() });
  }
  subjects.sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)));
  return { subjects, ambiguousCoordinates, labeledItems: groups.size };
}

/** Independent selective scans avoid an expensive Cartesian product of P18 and P373. */
const SUBJECT_SOURCES = [
  { name: 'featured-photos', claim: '?item wdt:P18 ?image.' },
  { name: 'commons-categories', claim: '?item wdt:P373 ?category.' }
];

export async function loadSubjectRegistry(directory, {
  fetcher = fetch, pageSize = 500, delayMs = 1000, timeoutMs = 75000, maxPages = 500, pause
} = {}) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 5000)
    throw Error('Wikidata pageSize must be between 1 and 5000');
  const resultPath = path.join(directory, 'wikidata-subjects.json');
  try {
    const cached = JSON.parse(await readFile(resultPath, 'utf8'));
    if (cached.schemaVersion === 3 && Array.isArray(cached.subjects) && cached.complete === true) return cached;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const client = new CrawlClient({ origin: 'https://query.wikidata.org',
    cacheDirectory: path.join(directory, 'wikidata-http'), delayMs, timeoutMs, fetcher, pause });
  const bindings = [];
  const requests = [];
  let fetchedAt;
  for (const source of SUBJECT_SOURCES) {
    let complete = false;
    for (let page = 0; page < maxPages; page++) {
      // A full-Indonesia OPTIONAL + OPTIONAL query exploded the intermediate
      // result set and timed out; this scans one indexed claim at a time.
      const query = [
        'SELECT ?item ?label ?image ?coordinates ?category WHERE {',
        source.claim,
        '?item wdt:P17 wd:Q252; wdt:P625 ?coordinates.',
        LABELS,
        '}'
      ].join('\n') + ' ORDER BY ?item ?label ?image ?coordinates ?category'
        + ' LIMIT ' + pageSize + ' OFFSET ' + (page * pageSize);
      const url = SPARQL + '?' + new URLSearchParams({ query, format: 'json' });
      console.log('Wikidata', source.name, 'page', page + 1, '(cached if previously downloaded)');
      const response = await client.get(url);
      const payload = JSON.parse(response.body);
      if (payload.error) throw Error('Wikidata query failed: ' + (payload.error.info ?? payload.error.code));
      const rows = payload.results?.bindings;
      if (!Array.isArray(rows)) throw Error('Invalid Wikidata subject export');
      fetchedAt ??= response.fetchedAt;
      requests.push({ source: source.name, url, fetchedAt: response.fetchedAt, rows: rows.length });
      bindings.push(...rows);
      console.log('Wikidata', source.name, 'page', page + 1, 'rows', rows.length);
      if (rows.length < pageSize) {
        complete = true;
        break;
      }
    }
    if (!complete) throw Error('Wikidata ' + source.name + ' exceeded bounded pagination; completed pages are cached');
  }
  const normalized = registrySubjects(bindings);
  const result = { schemaVersion: 3, complete: true, fetchedAt,
    source: 'Wikidata CC0; separately paginated P18 featured photos and P373 Commons categories, P17 Indonesia and P625 coordinates, id/en names and aliases',
    scope: 'Candidate registry, not proof that every Indonesian destination is represented',
    requests, ...normalized };
  await saveJson(resultPath, result);
  return result;
}

async function commonsResponse(client, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await client.get(url);
    const payload = JSON.parse(response.body);
    if (!payload.error) return { payload, fetchedAt: response.fetchedAt };
    if (!['maxlag', 'ratelimited', 'readonly'].includes(payload.error.code) || attempt === 3) {
      throw Error('Commons metadata error: ' + payload.error.code + ': ' + payload.error.info);
    }
    await client.evictGet(url);
    const delayMs = 5000 * (attempt + 1);
    console.warn('Commons API backing off:', payload.error.code, delayMs);
    await client.pause(delayMs);
  }
  throw Error('Commons API retry limit reached');
}

/** Metadata requests are batched only after subject/location verification. */
export async function loadCommonsPages(titles, directory, { fetcher = fetch, delayMs = 1000, pause } = {}) {
  const client = new CrawlClient({ origin: 'https://commons.wikimedia.org',
    cacheDirectory: path.join(directory, 'commons-http'), delayMs, fetcher, pause });
  const pages = new Map();
  const unique = [...new Set(titles)].sort();
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50);
    const params = new URLSearchParams({ action: 'query', format: 'json', redirects: '1',
      titles: batch.join('|'), prop: 'imageinfo',
      iiprop: 'url|size|mime|mediatype|extmetadata|timestamp|sha1', iiurlwidth: '640', maxlag: '5' });
    const response = await commonsResponse(client, 'https://commons.wikimedia.org/w/api.php?' + params);
    const payload = response.payload;
    if (!payload.query?.pages) throw Error('Invalid Commons metadata response');
    const aliases = new Map();
    for (const item of [...(payload.query.normalized ?? []), ...(payload.query.redirects ?? [])]) aliases.set(item.from, item.to);
    const byTitle = new Map(Object.values(payload.query.pages).map(page => [page.title, page]));
    for (const requested of batch) {
      let canonical = requested;
      const seen = new Set();
      while (aliases.has(canonical) && !seen.has(canonical)) {
        seen.add(canonical); canonical = aliases.get(canonical);
      }
      const page = byTitle.get(canonical);
      if (page) pages.set(requested, { page, retrievedAt: response.fetchedAt });
    }
  }
  return pages;
}

/**
 * A Commons category is considered only after its Wikidata subject has passed
 * the exact destination name + subject coordinate check.
 * Direct File: members only; unrelated subcategory trees are NOT traversed.
 */
export async function loadCommonsCategoryMembers(categories, directory, {
  fetcher = fetch, delayMs = 1000, pause, maxFiles = 80
} = {}) {
  const client = new CrawlClient({ origin: 'https://commons.wikimedia.org',
    cacheDirectory: path.join(directory, 'commons-category-http'), delayMs, fetcher, pause });
  const results = new Map();
  for (const category of [...new Set(categories)].sort()) {
    if (typeof category !== 'string' || !/^[^\u0000-\u001f<>\[\]{}|"'`]{1,180}$/.test(category)) continue;
    const params = new URLSearchParams({ action: 'query', format: 'json', list: 'categorymembers',
      cmtitle: 'Category:' + category, cmnamespace: '6', cmlimit: String(maxFiles), maxlag: '5' });
    const { payload } = await commonsResponse(client, 'https://commons.wikimedia.org/w/api.php?' + params);
    const files = payload.query?.categorymembers;
    if (!Array.isArray(files)) throw Error('Invalid Commons category response: ' + category);
    results.set(category, files.map(item => item.title)
      .filter(title => /^File:[^\u0000-\u001f<>\[\]{}|"'`]{1,220}$/.test(title)));
  }
  return results;
}

import path from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { CrawlClient } from './crawl-http.mjs';

const SPARQL = 'https://query.wikidata.org/sparql';
const LABELS = `?item (rdfs:label|skos:altLabel) ?label.
  FILTER(LANG(?label) = "id" || LANG(?label) = "en")`;
const SUBJECTS = '?item wdt:P17 wd:Q252; wdt:P18 ?image; wdt:P625 ?coordinates.';

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
    if (!id || !point || !title || typeof label !== 'string' || !label.trim()) continue;
    const lon = Number(point[1]);
    const lat = Number(point[2]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
    const group = groups.get(id) ?? { id, labels: new Set(), points: new Map(), imageTitles: new Set() };
    group.labels.add(label.trim());
    group.points.set(lon + ',' + lat, { lon, lat });
    group.imageTitles.add(title);
    groups.set(id, group);
  }
  const subjects = [];
  let ambiguousCoordinates = 0;
  for (const group of groups.values()) {
    if (group.points.size !== 1) { ambiguousCoordinates++; continue; }
    const point = [...group.points.values()][0];
    const imageTitles = [...group.imageTitles].sort();
    subjects.push({ id: group.id, labels: [...group.labels].sort(), lat: point.lat, lon: point.lon,
      imageTitle: imageTitles[0], imageTitles });
  }
  subjects.sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)));
  return { subjects, ambiguousCoordinates, labeledItems: groups.size };
}

export async function loadSubjectRegistry(directory, { fetcher = fetch, pageSize = 5000, delayMs = 1000 } = {}) {
  const resultPath = path.join(directory, 'wikidata-subjects.json');
  try {
    const cached = JSON.parse(await readFile(resultPath, 'utf8'));
    if (cached.schemaVersion !== 1 || !Array.isArray(cached.subjects) || cached.complete !== true) throw Error('Invalid subject registry cache');
    return cached;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const client = new CrawlClient({ origin: 'https://query.wikidata.org',
    cacheDirectory: path.join(directory, 'wikidata-http'), delayMs, timeoutMs: 75000, fetcher });
  const bindings = [];
  const requests = [];
  let fetchedAt;
  for (let page = 0; page < 100; page++) {
    const query = `SELECT ?item ?label ?image ?coordinates WHERE { ${SUBJECTS} ${LABELS} }
ORDER BY ?item ?label ?image ?coordinates LIMIT ${pageSize} OFFSET ${page * pageSize}`;
    const url = SPARQL + '?' + new URLSearchParams({ query, format: 'json' });
    const response = await client.get(url);
    const payload = JSON.parse(response.body);
    const rows = payload.results?.bindings;
    if (!Array.isArray(rows)) throw Error('Invalid Wikidata subject export');
    fetchedAt ??= response.fetchedAt;
    requests.push({ url, fetchedAt: response.fetchedAt, rows: rows.length });
    bindings.push(...rows);
    console.log('Wikidata registry page', page + 1, 'rows', rows.length);
    if (rows.length === pageSize) continue;
    const normalized = registrySubjects(bindings);
    const result = { schemaVersion: 1, complete: true, fetchedAt,
      source: 'Wikidata CC0; P17 Indonesia, P18 Commons image, P625 subject coordinate, id/en labels and aliases',
      scope: 'Candidate registry, not proof that every Indonesian destination is represented',
      requests, ...normalized };
    await saveJson(resultPath, result);
    return result;
  }
  throw Error('Wikidata registry exceeded the bounded pagination limit');
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

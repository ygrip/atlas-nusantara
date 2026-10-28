// iNaturalist supplement: every species observed in Indonesia (place 6966) with common names, IUCN status, photo and
// a short Wikipedia description, matched to the SC_indonesia backbone by scientific name.
// Usage: node scripts/species/fetch-inat.mjs
// Run it twice: once to list the observed species, then (after resolve-names.mjs) again to match them and fetch summaries.
// Needs: tmp/species-cache/backbone.json.  Output: tmp/species-cache/inat.json  { [gbifKey]: record }
import { fetchJson, loadAllSpecies, makeKeyResolver, mapConcurrent, readCache, sleep, writeCache } from './common.mjs';

const API = 'https://api.inaturalist.org/v1/';
const PLACE_ID = 6966; // Indonesia
const REQUEST_DELAY_MS = 1100;
const PAGE_SIZE = 500;
const MAX_RESULTS_PER_QUERY = 9500; // the API serves at most 10,000 rows per query
const ICONIC_TAXA = ['Plantae', 'Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Insecta', 'Arachnida', 'Mollusca', 'Animalia'];
const YEAR_WINDOWS = [[1800, 2014], [2015, 2018], [2019, 2020], [2021, 2022], [2023, 2023], [2024, 2024], [2025, 2030]];
const SUMMARY_LENGTH = 320;

async function call(path) {
  await sleep(REQUEST_DELAY_MS);
  return fetchJson(API + path);
}

async function pageThrough(query) {
  const first = await call('observations/species_counts?' + query + '&per_page=' + PAGE_SIZE + '&page=1');
  const results = [...first.results];
  for (let page = 2; results.length < first.total_results && page <= 20; page++) {
    const next = await call('observations/species_counts?' + query + '&per_page=' + PAGE_SIZE + '&page=' + page);
    if (next.results.length === 0) break;
    results.push(...next.results);
  }
  return { total: first.total_results, results };
}

async function observedSpecies() {
  const found = new Map();
  for (const iconic of ICONIC_TAXA) {
    const base = 'place_id=' + PLACE_ID + '&rank=species&locale=id&iconic_taxa=' + iconic;
    const probe = await call('observations/species_counts?' + base + '&per_page=1');
    const windows = probe.total_results > MAX_RESULTS_PER_QUERY ? YEAR_WINDOWS.map(([from, to]) => '&d1=' + from + '-01-01&d2=' + to + '-12-31') : [''];
    for (const window of windows) {
      const { results } = await pageThrough(base + window);
      for (const row of results) if (!found.has(row.taxon.id)) found.set(row.taxon.id, { ...row.taxon, observationsInIndonesia: row.count });
    }
    console.log(iconic, 'cumulative species:', found.size);
  }
  return found;
}

function shorten(html) {
  const text = html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= SUMMARY_LENGTH) return text;
  const cut = text.slice(0, SUMMARY_LENGTH);
  const lastStop = cut.lastIndexOf('. ');
  return lastStop > 120 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…';
}

function toRecord(taxon) {
  const photo = taxon.default_photo;
  return {
    inatId: taxon.id, commonNameId: taxon.preferred_common_name ?? '', commonNameEn: taxon.english_common_name ?? '',
    iucn: taxon.conservation_status?.authority === 'IUCN Red List' ? taxon.conservation_status.status.toUpperCase() : '',
    nativeIn: taxon.establishment_means?.establishment_means ?? '',
    observations: taxon.observationsInIndonesia, wikipediaUrl: taxon.wikipedia_url ?? '',
    photos: photo ? [toGalleryPhoto({ url: photo.url, attribution: photo.attribution, license_code: photo.license_code })].filter(Boolean) : []
  };
}

const GALLERY_SIZE = 4;

/** Compact gallery entry: the photo id and extension rebuild every URL; credit is the author's name only. */
function toGalleryPhoto(photo) {
  const match = /\/photos\/(\d+)\/[a-z]+\.([a-z]+)$/.exec(photo.url ?? '');
  if (!match) return undefined;
  const credit = photo.attribution_name || /^\(c\) ([^,]+)/.exec(photo.attribution ?? '')?.[1] || '';
  return { id: Number(match[1]), ext: match[2], credit, license: photo.license_code ?? '' };
}

function galleryOf(taxon) {
  const photos = (taxon.taxon_photos ?? []).map(entry => toGalleryPhoto(entry.photo)).filter(Boolean);
  if (photos.length === 0 && taxon.default_photo) photos.push(toGalleryPhoto(taxon.default_photo));
  return photos.filter(Boolean).slice(0, GALLERY_SIZE);
}

/** Summary and gallery per taxon, cached per language so a second run only asks for taxa it has not seen. */
async function taxonDetails(ids, locale) {
  const cacheName = 'inat-taxa-' + locale + '.json';
  const cached = (await readCache(cacheName)) ?? {};
  const todo = ids.filter(id => !(id in cached));
  const batches = [];
  for (let index = 0; index < todo.length; index += 30) batches.push(todo.slice(index, index + 30));
  await mapConcurrent(batches, 1, async batch => {
    const result = await call('taxa/' + batch.join(',') + '?locale=' + locale);
    const answered = new Set();
    for (const taxon of result?.results ?? []) {
      cached[taxon.id] = { summary: taxon.wikipedia_summary ? shorten(taxon.wikipedia_summary) : '', photos: galleryOf(taxon) };
      answered.add(taxon.id);
    }
    for (const id of batch) if (!answered.has(id)) cached[id] = { summary: '', photos: [] };
  }, { every: 20, label: 'taxon batches (' + locale + ')' });
  await writeCache(cacheName, cached);
  return new Map(ids.map(id => [id, cached[id]]));
}

async function main() {
  const keyFor = makeKeyResolver(await loadAllSpecies(), (await readCache('name-resolution.json')) ?? {});

  let observed = await readCache('inat-observed.json');
  if (!observed) {
    observed = [...(await observedSpecies()).values()];
    await writeCache('inat-observed.json', observed);
  }
  console.log('iNaturalist species observed in Indonesia:', observed.length);

  const matched = new Map();
  for (const taxon of observed) {
    const key = keyFor(taxon.name);
    if (key && !matched.has(key)) matched.set(key, toRecord(taxon));
  }
  console.log('Matched to backbone:', matched.size);

  const ids = [...matched.values()].map(record => record.inatId);
  const indonesian = await taxonDetails(ids, 'id');
  const missing = ids.filter(id => !indonesian.get(id).summary);
  const english = await taxonDetails(missing, 'en');
  for (const record of matched.values()) {
    const inId = indonesian.get(record.inatId);
    const inEn = english.get(record.inatId);
    record.summary = inId.summary || inEn?.summary || '';
    record.summaryLanguage = '';
    if (inId.summary) record.summaryLanguage = 'id';
    else if (inEn?.summary) record.summaryLanguage = 'en';
    if (inId.photos.length > 0) record.photos = inId.photos;
    if (record.photos.length === 0) delete record.photos;
  }
  await writeCache('inat.json', Object.fromEntries(matched));
  console.log('Records with summary:', [...matched.values()].filter(record => record.summary).length, 'with photos:', [...matched.values()].filter(record => record.photos).length);
}

main().catch(error => { console.error(error); process.exitCode = 1; });

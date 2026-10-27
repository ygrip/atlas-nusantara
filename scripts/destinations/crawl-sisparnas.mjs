import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CrawlClient } from './crawl-http.mjs';

const ORIGIN = 'https://sisparnas.kemenpar.go.id';
const SOURCE_URL = ORIGIN + '/datapanel';
const ENDPOINT = ORIGIN + '/getdata/peta?scope=dtw';
const CATEGORY_FILTERS = [
  { id: '1', label: 'Wisata Alam' },
  { id: '2', label: 'Wisata Buatan' },
  { id: '3', label: 'Wisata Budaya' }
];

function decodeText(value) {
  return value.replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:0?39|x27);/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSelect(html, id) {
  const pattern = new RegExp(
    `<select\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/select>`,
    'i'
  );
  const match = html.match(pattern);
  if (!match) throw Error('SISPARNAS page has no ' + id + ' selector');
  return match[1];
}

export function parseSelectedYear(html) {
  const select = findSelect(html, 'tahun');
  const options = [...select.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
  const selected = options.find(match => /\bselected\b/i.test(match[1]));
  const option = selected ?? options[0];
  if (!option) throw Error('SISPARNAS year selector is empty');

  const value = option[1].match(/\bvalue=["']([^"']*)["']/i);
  let year = decodeText(option[2]);
  if (value) year = value[1].trim();
  if (!/^\d{4}$/.test(year)) throw Error('Invalid SISPARNAS selected year');
  return year;
}

export function parseProvinceOptions(html) {
  const select = findSelect(html, 'idprov');
  const provinces = [];
  for (const match of select.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const value = match[1].match(/\bvalue=["']([^"']*)["']/i);
    if (!value || value[1] === '0') continue;
    const province = { id: value[1].trim(), name: decodeText(match[2]) };
    if (!/^\d+$/.test(province.id) || !province.name) throw Error('Invalid SISPARNAS province');
    if (provinces.some(item => item.id === province.id)) throw Error('Duplicate SISPARNAS province ID');
    provinces.push(province);
  }
  return provinces;
}

/** Parse the public HTML table rows and their loadProv/loadKota source IDs. */
export function parseRegionRows(html, loader) {
  if (!['loadProv', 'loadKota'].includes(loader)) throw Error('Unsupported SISPARNAS table action');

  const actionPattern = new RegExp('\\b' + loader + '\\s*\\(\\s*(\\d+)\\s*\\)', 'i');
  const rows = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(cell => cell[1]);
    if (cells.length < 4) continue;

    const action = row[1].match(actionPattern);
    if (!action) continue;

    const name = decodeText(cells[1]);
    const countText = decodeText(cells[2]).replace(/[,\s]/g, '');
    if (!name || !/^\d+$/.test(countText)) {
      throw Error('Malformed SISPARNAS region table row');
    }

    rows.push({ id: action[1], name, count: Number(countText) });
  }
  return rows;
}

/** Keep only public factual map fields; discard popup text and icon/image URLs. */
export function parseMarkerResponse(body) {
  const response = parseApiResponse(body);
  return response.data.map(marker => {
    const id = String(marker.id ?? '').trim();
    const name = String(marker.title ?? '').trim();
    const lat = String(marker.lat ?? '').trim();
    const lng = String(marker.lng ?? '').trim();
    if (!id || !name) throw Error('SISPARNAS marker lacks factual fields');
    return { id, name, lat, lng };
  });
}

function parseApiResponse(body) {
  let response;
  try {
    response = JSON.parse(body);
  } catch {
    throw Error('SISPARNAS returned non-JSON data');
  }
  if (response.status !== true || response.scope !== 'dtw'
    || !Array.isArray(response.data) || typeof response.list !== 'string') {
    throw Error('Unrecognized SISPARNAS DTW response');
  }
  return response;
}


async function save(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename + '.partial', JSON.stringify(value) + '\n');
  await rename(filename + '.partial', filename);
}

function addMarker(state, marker, province, district, fetchedAt) {
  state.records.set(marker.id, { ...marker, provId: province.id, province: province.name,
    districtId: district.id, district: district.name, retrievedAt: fetchedAt });
}

async function collectCategories(state, province, district) {
  for (const category of CATEGORY_FILTERS) {
    const filtered = await state.load({ idprov: province.id, idkota: district.id, idjenis: category.id });
    for (const marker of parseMarkerResponse(JSON.stringify(filtered))) {
      if (!state.records.has(marker.id)) addMarker(state, marker, province, district, filtered.fetchedAt);
      const memberships = state.categoryMembers.get(marker.id) ?? new Set();
      memberships.add(Number(category.id));
      state.categoryMembers.set(marker.id, memberships);
      const record = state.records.get(marker.id);
      if (memberships.size === 1) record.sourceCategory = Number(category.id);
      else {
        delete record.sourceCategory;
        if (!state.report.categoryConflicts.includes(marker.id)) state.report.categoryConflicts.push(marker.id);
      }
    }
  }
}

async function collectDistrict(state, province, district) {
  const result = await state.load({ idprov: province.id, idkota: district.id });
  const markers = parseMarkerResponse(JSON.stringify(result));
  state.report.districtsAttempted++;
  state.report.sumExpectedByDistrict += district.count;
  if (markers.length) state.report.nonemptyDistrictResponses++;
  if (markers.length !== district.count) state.report.mismatches.push({ provinceId: province.id,
    districtId: district.id, expected: district.count, actual: markers.length });
  for (const marker of markers) {
    if (state.records.has(marker.id)) { state.report.duplicates++; continue; }
    addMarker(state, marker, province, district, result.fetchedAt);
  }
  if (state.categories) await collectCategories(state, province, district);
}

async function collectProvince(state, province) {
  const response = await state.load({ idprov: province.id });
  const districts = parseRegionRows(response.list, 'loadKota');
  const expectedProvince = state.nationalRows.find(row => row.id === province.id);
  if (!expectedProvince) throw Error('Unknown source province in national table');
  const count = districts.reduce((total, row) => total + row.count, 0);
  if (count !== expectedProvince.count) state.report.provinceMismatches.push({
    provinceId: province.id, nationalCount: expectedProvince.count, districtCount: count });
  for (const district of districts) await collectDistrict(state, province, district);
  await state.checkpoint();
  console.log('SISPARNAS province:', province.name, 'unique records:', state.records.size);
}

export async function crawlSisparnas({ outputDirectory, delayMs = 1000, categories = false, fetcher = fetch }) {
  const client = new CrawlClient({ origin: ORIGIN, cacheDirectory: path.join(outputDirectory, 'http-cache'), delayMs, fetcher });
  try {
    const robots = await client.get('/robots.txt');
    if (/^\s*Disallow:\s*\/(?:\s*$|datapanel|getdata)/im.test(robots.body)) throw Error('robots.txt restricts SISPARNAS crawling');
  } catch (error) {
    if (!error.message.startsWith('Crawler HTTP 404:')) throw error;
  }
  const page = await client.get('/datapanel?scope=dtw');
  const provinces = parseProvinceOptions(page.body);
  if (provinces.length !== 38) throw Error('Expected 38 SISPARNAS province options');
  const defaults = { idprov: '0', idkota: '0', tahun: parseSelectedYear(page.body),
    wilayah: 'area', idkap: '0', idjenis: '0', iddsp: '', iddpp: '' };
  async function load(fields) {
    const response = await client.postForm(ENDPOINT, { ...defaults, ...fields });
    return { ...parseApiResponse(response.body), fetchedAt: response.fetchedAt };
  }
  const national = await load({});
  const nationalRows = parseRegionRows(national.list, 'loadProv');
  if (nationalRows.length !== 38) throw Error('Expected 38 province aggregate rows');
  const sum = rows => rows.reduce((total, row) => total + row.count, 0);
  const records = new Map();
  const report = { state: 'running', fetchedAt: national.fetchedAt, sourceUrl: SOURCE_URL,
    provinceOptions: 38, districtsAttempted: 0, nonemptyDistrictResponses: 0,
    sumExpectedByDistrict: 0, nationalAggregateReported: sum(nationalRows), duplicates: 0,
    mismatches: [], provinceMismatches: [], categoryFilters: [], categoryConflicts: [],
    districtCountMismatchDetailsComplete: true, crawlEndpoint: ENDPOINT, crawlRequestDefaults: defaults,
    provinceIds: provinces.map(item => ({ provId: item.id, province: item.name })) };
  const categoryMembers = new Map();
  async function checkpoint() {
    const factualRecords = [...records.values()].sort((left, right) => Number(left.id) - Number(right.id));
    await save(path.join(outputDirectory, 'inventory.json'), { ...report,
      records: factualRecords.length, uniqueIds: factualRecords.length,
      partialCountMismatches: report.mismatches.length, factualRecords });
  }
  for (const category of CATEGORY_FILTERS) {
    const response = await load({ idjenis: category.id });
    const rows = parseRegionRows(response.list, 'loadProv');
    report.categoryFilters.push({ idjenis: category.id, label: category.label,
      nationalAggregateCount: sum(rows), provinceRows: rows.length });
  }
  await checkpoint();
  const state = { load, report, records, categoryMembers, categories, nationalRows, checkpoint };
  try {
    for (const province of provinces) await collectProvince(state, province);
    report.state = 'completed';
    report.completedAt = new Date().toISOString();
    report.complete = records.size === report.nationalAggregateReported && !report.mismatches.length
      && !report.provinceMismatches.length && !report.duplicates;
    await checkpoint();
  } catch (error) {
    report.state = 'stopped';
    report.error = error.message;
    await checkpoint();
    throw error;
  }
  return { ...report, uniqueIds: records.size, output: path.join(outputDirectory, 'inventory.json') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDirectory = process.argv[2];
  if (!outputDirectory) throw Error('Usage: node scripts/destinations/crawl-sisparnas.mjs <output-directory> [--categories]');
  try {
    const report = await crawlSisparnas({ outputDirectory, categories: process.argv.includes('--categories') });
    console.log(JSON.stringify({ collected: report.uniqueIds, expected: report.nationalAggregateReported,
      complete: report.complete, output: report.output }));
    if (!report.complete) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

// Builds static/data/observations/population-regions/<province>.json from the BPS statistics tables
// "Jumlah Penduduk Laki-Laki / Perempuan menurut Kabupaten/Kota dan Kelompok Umur".
// BPS renders each table with the latest year embedded in the page, so no API key is needed.
// Usage: node scripts/population/build-region-pyramids.mjs
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MALE_URL = 'https://www.bps.go.id/id/statistics-table/2/Mjc5MSMy/jumlah-penduduk-laki-laki-menurut-kabupaten-kota-dan-kelompok-umur--.html';
const FEMALE_URL = 'https://www.bps.go.id/id/statistics-table/2/Mjc5MiMy/jumlah-penduduk-perempuan-menurut-kabupaten-kota-dan-kelompok-umur.html';
const VARIABLE_MALE = 2791;
const VARIABLE_FEMALE = 2792;
const FIRST_AGE_GROUP_ID = 24;
const AGE_GROUP_COUNT = 16;
const INDONESIA_ROW = 9999;
const OUTPUT_DIRECTORY = 'static/data/observations/population-regions';
const ADMIN_DIRECTORY = 'static/data/admin-2025';
/** BPS still numbers the Papua provinces in its own order; these are the atlas codes. */
const BPS_PROVINCE_TO_ATLAS = { 9100: '92', 9200: '96', 9400: '91', 9500: '93', 9600: '94', 9700: '95' };
/** The BPS table still lists Papua and Papua Barat as they were before the 2022 split, so these two rows describe the wrong area. Their totals are rebuilt from the regencies. */
const LEGACY_PROVINCE_ROWS = new Set([9100, 9400]);
/** BPS labels that differ from the atlas name after normalisation. */
const NAME_ALIASES = {
  'B:tobasamosirtoba': 'B:toba',
  'B:kepseribu': 'B:kepulauanseribu',
  'K:makasar': 'K:makassar',
  'B:mamujuutarapasangkayu': 'B:pasangkayu',
  'B:malukutenggarabaratkepulauantanimbar': 'B:kepulauantanimbar',
  'B:siautagulandangbiaro': 'B:kepsiautagulandangbiaro'
};

function normaliseName(label) {
  const lower = label.replace(/<[^>]+>/g, '').toLowerCase();
  const isCity = lower.includes('kota ');
  const letters = lower.replace('kabupaten', '').replace('kota ', '').replace('kab.', '').replace('administrasi', '').replace(/[^a-z]/g, '');
  const key = (isCity ? 'K:' : 'B:') + letters;
  return NAME_ALIASES[key] ?? key;
}

async function fetchTable(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AtlasNusantaraResearch/0.1' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('BPS responded with HTTP ' + response.status + ' for ' + url);
  const html = await response.text();
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"(.*?)"\]\)<\/script>/gs)].map(match => JSON.parse('"' + match[1] + '"'));
  const payload = chunks.join('');
  const rows = parseAfter(payload, '"vervar":');
  const content = parseAfter(payload, '"datacontent":');
  const year = Number(/"tahun":\[\{"val":\d+,"label":"(\d+)"/.exec(payload)?.[1]);
  const yearId = /"tahun":\[\{"val":(\d+)/.exec(payload)?.[1];
  const lastUpdate = /"last_update":"([^"]*)"/.exec(payload)?.[1];
  if (!Array.isArray(rows) || !content || !Number.isInteger(year) || !yearId) throw new Error('BPS table layout changed: ' + url);
  return { rows, content, year, yearId, lastUpdate };
}

/** Parses the JSON value that follows a marker such as `"vervar":` in the embedded page payload. */
function parseAfter(payload, marker) {
  const start = payload.indexOf(marker);
  if (start < 0) throw new Error('Missing ' + marker);
  return JSON.parse(extractJson(payload, start + marker.length));
}

function extractJson(text, start) {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  throw new Error('Unterminated JSON in BPS payload');
}

function ageValues(table, variable, rowId) {
  const values = [];
  for (let group = 0; group < AGE_GROUP_COUNT; group++) {
    const value = table.content['' + rowId + variable + (FIRST_AGE_GROUP_ID + group) + table.yearId + '0'];
    if (!Number.isFinite(value)) throw new Error('Missing BPS value for row ' + rowId + ' age group ' + group);
    values.push(value);
  }
  return values;
}

async function loadAtlasRegions() {
  const provinces = JSON.parse(await readFile(path.join(ADMIN_DIRECTORY, 'provinces.json'), 'utf8')).regions;
  const regencies = [];
  for (const file of await readdir(path.join(ADMIN_DIRECTORY, 'cities'))) {
    regencies.push(...JSON.parse(await readFile(path.join(ADMIN_DIRECTORY, 'cities', file), 'utf8')).regions);
  }
  return { provinces, regencies };
}

function atlasProvinceCode(bpsRowId) {
  return BPS_PROVINCE_TO_ATLAS[bpsRowId] ?? String(bpsRowId).slice(0, 2);
}

async function main() {
  const [male, female, atlas] = await Promise.all([fetchTable(MALE_URL), fetchTable(FEMALE_URL), loadAtlasRegions()]);
  if (male.year !== female.year) throw new Error('Male and female tables describe different years');
  const regenciesByName = new Map();
  for (const regency of atlas.regencies) {
    const key = normaliseName(regency.name);
    regenciesByName.set(key, [...(regenciesByName.get(key) ?? []), regency]);
  }
  const byProvince = new Map();
  const unmatched = [];
  for (const row of male.rows) {
    if (row.val === INDONESIA_ROW) continue;
    const entry = { male: ageValues(male, VARIABLE_MALE, row.val), female: ageValues(female, VARIABLE_FEMALE, row.val) };
    const isProvince = row.label.includes('<b>');
    if (isProvince && LEGACY_PROVINCE_ROWS.has(row.val)) continue;
    if (isProvince) {
      const code = atlasProvinceCode(row.val);
      if (!atlas.provinces.some(province => province.code === code)) throw new Error('No atlas province for BPS row ' + row.val);
      byProvince.set(code, { ...(byProvince.get(code) ?? {}), [code]: entry });
      continue;
    }
    const matches = regenciesByName.get(normaliseName(row.label)) ?? [];
    if (matches.length !== 1) {
      unmatched.push(row.val + ' ' + row.label + ' -> ' + matches.map(item => item.code).join(','));
      continue;
    }
    const code = matches[0].code;
    const province = matches[0].parentCode;
    byProvince.set(province, { ...(byProvince.get(province) ?? {}), [code]: entry });
  }
  for (const code of LEGACY_PROVINCE_ROWS.values()) {
    const provinceCode = atlasProvinceCode(code);
    const regions = byProvince.get(provinceCode);
    const members = Object.values(regions);
    const sumAges = sex => Array.from({ length: AGE_GROUP_COUNT }, (_, group) => members.reduce((sum, member) => sum + member[sex][group], 0));
    regions[provinceCode] = { male: sumAges('male'), female: sumAges('female') };
  }
  if (unmatched.length > 0) throw new Error('Unmatched BPS regions:\n' + unmatched.join('\n'));
  const expected = atlas.provinces.length + atlas.regencies.length;
  const produced = [...byProvince.values()].reduce((sum, regions) => sum + Object.keys(regions).length, 0);
  if (produced !== expected) throw new Error('Expected ' + expected + ' regions, produced ' + produced);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const ageGroups = ['0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75+'];
  for (const [province, regions] of byProvince) {
    const document = {
      schemaVersion: 1,
      kind: 'population-pyramid-regions',
      source: 'BPS-Statistics Indonesia',
      sourceUrl: FEMALE_URL,
      maleSourceUrl: MALE_URL,
      attribution: 'Badan Pusat Statistik (BPS), Jumlah Penduduk Laki-Laki / Perempuan menurut Kabupaten/Kota dan Kelompok Umur, projection from the 2020 Population Census.',
      fetchedAt: new Date().toISOString(),
      sourceUpdatedAt: male.lastUpdate,
      year: male.year,
      unit: 'persons',
      provinceCode: province,
      ageGroups,
      regions
    };
    await writeFile(path.join(OUTPUT_DIRECTORY, province + '.json'), JSON.stringify(document) + '\n');
  }
  console.log('Wrote ' + byProvince.size + ' provinces, ' + produced + ' regions, year ' + male.year);
}

main().catch(error => { console.error(error); process.exitCode = 1; });

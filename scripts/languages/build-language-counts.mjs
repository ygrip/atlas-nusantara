// Builds static/data/observations/languages.json from Badan Bahasa's "Peta Bahasa" (https://petabahasa.kemendikdasmen.go.id).
// The language list names the province(s) of each language as they were before the 2022 Papua split (34 provinces).
// Languages listed under Papua or Papua Barat are placed in the 2025 provinces from the districts named on their detail page.
// Usage: node scripts/languages/build-language-counts.mjs [--refresh]
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://petabahasa.kemendikdasmen.go.id';
const LIST_URL = ORIGIN + '/databahasa.php';
const CACHE_DIRECTORY = 'tmp/languages-cache';
const OUTPUT_FILE = 'static/data/observations/languages.json';
const ADMIN_DIRECTORY = 'static/data/admin-2025';
const REQUEST_DELAY_MS = 400;
const USER_AGENT = 'Mozilla/5.0 AtlasNusantaraResearch/0.1';
const refresh = process.argv.includes('--refresh');

/** Source province name to atlas code, for provinces that were not split. */
const PROVINCE_CODES = {
  'Aceh': '11', 'Sumatra Utara': '12', 'Sumatra Barat': '13', 'Riau': '14', 'Jambi': '15', 'Sumatra Selatan': '16',
  'Bengkulu': '17', 'Lampung': '18', 'Kepulauan Bangka Belitung': '19', 'Kepulauan Riau': '21',
  'DKI Jakarta': '31', 'Jawa Barat': '32', 'Jawa Tengah': '33', 'Daerah Istimewa Yogyakarta': '34', 'Jawa Timur': '35', 'Banten': '36',
  'Bali': '51', 'Nusa Tenggara Barat': '52', 'Nusa Tenggara Timur': '53',
  'Kalimantan Barat': '61', 'Kalimantan Tengah': '62', 'Kalimantan Selatan': '63', 'Kalimantan Timur': '64', 'Kalimantan Utara': '65',
  'Sulawesi Utara': '71', 'Sulawesi Tengah': '72', 'Sulawesi Selatan': '73', 'Sulawesi Tenggara': '74', 'Gorontalo': '75', 'Sulawesi Barat': '76',
  'Maluku': '81', 'Maluku Utara': '82'
};
/** Source provinces that were split; the atlas provinces they became. */
const SPLIT_PROVINCES = { 'Papua': ['91', '93', '94', '95'], 'Papua Barat': ['92', '96'] };

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function cachedText(url) {
  await mkdir(CACHE_DIRECTORY, { recursive: true });
  const file = path.join(CACHE_DIRECTORY, createHash('sha256').update(url).digest('hex') + '.html');
  if (!refresh) {
    try { return await readFile(file, 'latin1'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await sleep(REQUEST_DELAY_MS);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Peta Bahasa responded with HTTP ' + response.status + ' for ' + url);
  const text = Buffer.from(await response.arrayBuffer()).toString('latin1');
  await writeFile(file, text, 'latin1');
  return text;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function parseLanguageList(html) {
  const rows = [...html.matchAll(/<tr bgcolor=#\w+ valign=top>(.*?)<\/tr>/gs)];
  return rows.map(row => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(match => match[1]);
    // Each province of a language has its own detail page and id.
    const provinces = [...cells[3].matchAll(/<a href="infostatistik\.php\?idb=(\d+)[^>]*>(.*?)<\/a>/gs)].map(match => ({ id: match[1], name: stripTags(match[2]) }));
    return { name: stripTags(cells[1]), provinces };
  });
}

/** Spellings found in the descriptions that differ from the official district names. */
const DISTRICT_SPELLINGS = [
  ['memberamo', 'mamberamo'], ['monokwari', 'manokwari'], ['tambraw', 'tambrauw'], ['wandama', 'wondama'],
  ['bouven', 'boven'], ['beven', 'boven'], ['digoul', 'digoel'], ['digul', 'digoel'], ['yahokimo', 'yahukimo'], ['kabupatenyapen', 'kabupatenkepulauanyapen']
];

function normaliseDistrict(name) {
  return name.toLowerCase().replace(/^(kabupaten|kota|kab\.)\s+/, '').replace(/[^a-z]/g, '');
}

async function loadAtlasDistricts() {
  const byProvince = new Map();
  for (const file of await readdir(path.join(ADMIN_DIRECTORY, 'cities'))) {
    const document = JSON.parse(await readFile(path.join(ADMIN_DIRECTORY, 'cities', file), 'utf8'));
    byProvince.set(document.provinceCode, document.regions.map(region => normaliseDistrict(region.name)));
  }
  return byProvince;
}

/** Atlas provinces among `candidates` whose districts are named in the language description. */
function provincesFromDescription(description, candidates, districts) {
  let compact = description.toLowerCase().replace(/[^a-z]/g, '');
  for (const [wrong, right] of DISTRICT_SPELLINGS) compact = compact.replaceAll(wrong, right);
  return candidates.filter(code => districts.get(code).some(district => district.length >= 4 && compact.includes(district)));
}

async function placeInSplitProvince(language, source, districts, report) {
  const candidates = SPLIT_PROVINCES[source.name];
  const html = await cachedText(ORIGIN + '/infostatistik.php?idb=' + source.id);
  const menuEnd = html.indexOf('</ul>', html.indexOf('menuTemplate1'));
  if (menuEnd < 0) throw new Error('Peta Bahasa page layout changed for ' + language.name);
  const intro = stripTags(html.slice(menuEnd)).split('Badan Pengembangan')[0];
  // The first sentence names where the language is spoken; later ones mention neighbouring districts.
  const firstSentence = intro.slice(Math.max(0, intro.indexOf('dituturkan'))).split('Provinsi')[0];
  const matched = provincesFromDescription(firstSentence, candidates, districts);
  if (matched.length > 0) return matched;
  const fromWholeText = provincesFromDescription(intro, candidates, districts);
  if (fromWholeText.length > 0) return fromWholeText;
  // The source occasionally lists a district under the neighbouring old province (Teluk Bintuni under Papua), so try every Papua province.
  const anywhereInPapua = provincesFromDescription(firstSentence, Object.values(SPLIT_PROVINCES).flat(), districts);
  if (anywhereInPapua.length > 0) return anywhereInPapua;
  report.unplaced.push(language.name + ' (' + source.name + ')');
  return [];
}

async function main() {
  const languages = parseLanguageList(await cachedText(LIST_URL));
  const totalText = /Bahasa di Indonesia\s*:\s*(\d+)\s*Bahasa/.exec(await cachedText(LIST_URL));
  const declaredTotal = Number(totalText?.[1]);
  if (!Number.isInteger(declaredTotal) || declaredTotal !== languages.length) throw new Error('Language list does not match the declared total ' + declaredTotal + ' / ' + languages.length);
  const districts = await loadAtlasDistricts();
  const report = { unplaced: [] };
  const namesByProvince = new Map();
  const add = (code, name) => namesByProvince.set(code, [...(namesByProvince.get(code) ?? []), name]);

  for (const language of languages) {
    const placed = new Set();
    for (const source of language.provinces) {
      if (PROVINCE_CODES[source.name]) { placed.add(PROVINCE_CODES[source.name]); continue; }
      if (SPLIT_PROVINCES[source.name]) {
        for (const code of await placeInSplitProvince(language, source, districts, report)) placed.add(code);
        continue;
      }
      throw new Error('Unknown source province "' + source.name + '" for ' + language.name);
    }
    for (const code of placed) add(code, language.name);
  }

  const provinces = [...namesByProvince.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, names]) => ({
    code,
    count: names.length,
    languages: [...names].sort((a, b) => a.localeCompare(b, 'id'))
  }));
  const document = {
    schemaVersion: 1,
    kind: 'local-languages',
    source: 'Badan Pengembangan dan Pembinaan Bahasa, Kemendikdasmen',
    sourceUrl: LIST_URL,
    attribution: 'Peta Bahasa, Badan Pengembangan dan Pembinaan Bahasa, Kementerian Pendidikan Dasar dan Menengah.',
    fetchedAt: new Date().toISOString(),
    totalLanguages: languages.length,
    note: 'A language spoken in several provinces is counted in each of them. The source predates the 2022 Papua split; languages of Papua and Papua Barat are placed in the 2025 provinces from the districts named in their descriptions.',
    unplacedLanguages: report.unplaced,
    provinces
  };
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(document) + '\n');
  console.log('Wrote ' + provinces.length + ' provinces for ' + languages.length + ' languages; unplaced: ' + report.unplaced.length);
  console.log(provinces.map(item => item.code + ':' + item.count).join(' '));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

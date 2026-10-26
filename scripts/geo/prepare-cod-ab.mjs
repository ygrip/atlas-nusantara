// Converts the OCHA/BPS COD-AB Indonesia ADM2 layer (valid 2020-04-01, BPS codes)
// into the Kepmendagri 300.2.2-2430/2025 code edition used by the atlas.
//
// BPS and Kemendagri number regencies differently, and the 2025 edition splits Papua
// into six provinces, so codes are NEVER joined directly. Each 2025 region is matched
// to exactly one COD-AB unit by its normalized name inside the same province group,
// plus a short reviewed alias list for official renames. The resulting crosswalk is
// written to scripts/geo/crosswalk/cod-ab-2020-to-kepmendagri-2025.json for review,
// and the build fails unless the match is one-to-one for all 514 regions.
//
// Usage: node scripts/geo/prepare-cod-ab.mjs idn_admin2.geojson output-directory
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mapshaper from 'mapshaper';

const ADMIN_DIRECTORY = 'static/data/admin-2025';
const CROSSWALK_FILE = 'scripts/geo/crosswalk/cod-ab-2020-to-kepmendagri-2025.json';

/** Official renames between the 2020 COD-AB names and the 2025 Kemendagri names (key: 2025 code). */
export const REVIEWED_ALIASES = {
  '12.12': 'Toba Samosir',
  '31.01': 'Kepulauan Seribu',
  '31.71': 'Kota Jakarta Pusat',
  '31.72': 'Kota Jakarta Utara',
  '31.73': 'Kota Jakarta Barat',
  '31.74': 'Kota Jakarta Selatan',
  '31.75': 'Kota Jakarta Timur',
  '63.02': 'Kota Baru',
  '64.11': 'Mahakam Hulu',
  '71.09': 'Siau Tagulandang Biaro',
  '73.10': 'Pangkajene Dan Kepulauan',
  '76.01': 'Mamuju Utara',
  '81.03': 'Maluku Tenggara Barat'
};

/** COD-AB units that are lakes, reservoirs or forest areas, not regencies or cities. */
export const NON_ADMINISTRATIVE_UNITS = ['ID1288', 'ID1388', 'ID1688', 'ID1888', 'ID3288', 'ID3388', 'ID3399', 'ID7188'];

function provinceGroup(code) {
  const province = code.replace('ID', '').slice(0, 2);
  // All current Papua provinces (91-96) were carved from the 2020 Papua and Papua Barat units.
  if (province.startsWith('9')) return 'PAPUA';
  return province;
}

export function nameKey(name) {
  const upper = name.toUpperCase();
  const isCity = /^KOTA\s/.test(upper);
  let rest = upper.replace(/^(KABUPATEN ADMINISTRASI|KOTA ADMINISTRASI|KAB\. ADM\.|KOTA ADM\.|KABUPATEN|KAB\.|KOTA)\s+/, '');
  rest = rest.replace(/^KEP\.\s/, 'KEPULAUAN ').replace(/[^A-Z]/g, '');
  let kind = 'R';
  if (isCity) kind = 'C';
  return kind + rest;
}

export function buildCrosswalk(cities, features) {
  const unitsByKey = new Map();
  for (const feature of features) {
    const pcode = feature.properties.adm2_pcode;
    if (NON_ADMINISTRATIVE_UNITS.includes(pcode)) continue;
    const key = provinceGroup(feature.properties.adm1_pcode) + ':' + nameKey(feature.properties.adm2_name);
    const existing = unitsByKey.get(key) ?? [];
    existing.push(pcode);
    unitsByKey.set(key, existing);
  }
  const crosswalk = {};
  const used = new Set();
  for (const city of cities) {
    let name = city.name;
    if (REVIEWED_ALIASES[city.code]) name = REVIEWED_ALIASES[city.code];
    const key = provinceGroup(city.parentCode) + ':' + nameKey(name);
    const matches = unitsByKey.get(key) ?? [];
    if (matches.length !== 1) throw Error(`No unique COD-AB match for ${city.code} ${city.name} (${matches.length})`);
    if (used.has(matches[0])) throw Error('COD-AB unit matched twice: ' + matches[0]);
    used.add(matches[0]);
    crosswalk[city.code] = matches[0];
  }
  const administrativeUnits = features.filter(feature => !NON_ADMINISTRATIVE_UNITS.includes(feature.properties.adm2_pcode));
  if (used.size !== administrativeUnits.length) throw Error(`Unmatched COD-AB units: ${administrativeUnits.length - used.size}`);
  return crosswalk;
}

async function main([input, outputDirectory]) {
  if (!input || !outputDirectory) throw Error('Usage: node scripts/geo/prepare-cod-ab.mjs idn_admin2.geojson output-directory');
  const cities = JSON.parse(await readFile(resolve(ADMIN_DIRECTORY, 'cities.json'), 'utf8')).regions;
  if (cities.length !== 514) throw Error('Expected 514 regions in the 2025 edition');
  await mkdir(outputDirectory, { recursive: true });
  const sourceSha256 = createHash('sha256').update(await readFile(input)).digest('hex');

  // Topology-aware simplification keeps shared borders identical between neighbours.
  const simplifiedFile = resolve(outputDirectory, 'adm2-simplified.geojson');
  await mapshaper.runCommands(`-i "${input}" -simplify 6% weighted keep-shapes -clean -o "${simplifiedFile}" precision=0.00001 format=geojson`);
  const simplified = JSON.parse(await readFile(simplifiedFile, 'utf8'));
  const crosswalk = buildCrosswalk(cities, simplified.features);
  const byPcode = new Map(Object.entries(crosswalk).map(([code, pcode]) => [pcode, code]));
  const parentByCode = new Map(cities.map(city => [city.code, city.parentCode]));

  const features = [];
  for (const feature of simplified.features) {
    const code = byPcode.get(feature.properties.adm2_pcode);
    if (!code) continue;
    features.push({ type: 'Feature', properties: { code, province: parentByCode.get(code), sourceCode: feature.properties.adm2_pcode }, geometry: feature.geometry });
  }
  const cityCollection = { type: 'FeatureCollection', features };
  const cityFile = resolve(outputDirectory, 'cities-2025.geojson');
  await writeFile(cityFile, JSON.stringify(cityCollection));

  const provinceFile = resolve(outputDirectory, 'provinces-2025.geojson');
  await mapshaper.runCommands(`-i "${cityFile}" -dissolve province copy-fields=province -rename-fields code=province -o "${provinceFile}" precision=0.00001 format=geojson`);

  await mkdir(resolve('scripts/geo/crosswalk'), { recursive: true });
  await writeFile(CROSSWALK_FILE, JSON.stringify({
    source: 'OCHA COD-AB Indonesia v01 (BPS codes, valid 2020-04-01)',
    target: 'Kepmendagri 300.2.2-2430/2025',
    method: 'Normalized name match within province group (Papua 91-96 matched as one group) plus reviewed aliases; non-administrative water and forest units excluded.',
    aliases: REVIEWED_ALIASES,
    excludedSourceUnits: NON_ADMINISTRATIVE_UNITS,
    crosswalk
  }, null, 1) + '\n');

  const sha = async file => createHash('sha256').update(await readFile(file)).digest('hex');
  console.log(JSON.stringify({ sourceSha256, provinceSha256: await sha(provinceFile), citySha256: await sha(cityFile), features: features.length }));
}

if (process.argv[1]?.endsWith('prepare-cod-ab.mjs')) await main(process.argv.slice(2));

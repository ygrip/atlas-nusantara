// Which species GBIF has recorded in each Indonesian province (GADM level 1; Papua provinces refined through GADM level 2).
// Usage: node scripts/species/fetch-gbif-provinces.mjs
// Output: tmp/species-cache/gbif-provinces.json  { [gbifKey]: [provinceCode, ...] }  (every species GBIF holds for Indonesia;
// species outside the checklist backbone are kept so resolve-names.mjs can add protected species the checklist lacks)
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchJson, writeCache, normaliseName } from './common.mjs';

const API = 'https://api.gbif.org/v1/occurrence/search?country=ID&limit=0';
const KINGDOM_KEYS = { fauna: 1, flora: 6 };
const ADMIN_DIRECTORY = 'static/data/admin-2025';
/** GADM level-1 names that GBIF reports, normalised, to atlas province codes. Split provinces are handled separately. */
const SPLIT_SOURCE_PROVINCES = { papua: ['91', '93', '94', '95'], papuabarat: ['92', '96'] };

const squash = name => normaliseName(name).replaceAll(' ', '');

async function loadAtlas() {
  const provinces = JSON.parse(await readFile(path.join(ADMIN_DIRECTORY, 'provinces.json'), 'utf8')).regions;
  const districts = new Map();
  for (const file of await readdir(path.join(ADMIN_DIRECTORY, 'cities'))) {
    const document = JSON.parse(await readFile(path.join(ADMIN_DIRECTORY, 'cities', file), 'utf8'));
    districts.set(document.provinceCode, document.regions.map(region => squash(region.name.replace(/^(Kabupaten|Kota)\s+/, ''))));
  }
  return { provinces, districts };
}

async function facet(parameters, field) {
  const result = await fetchJson(API + parameters + '&facet=' + field + '&facetLimit=100000');
  return result.facets[0].counts.map(count => ({ name: count.name, count: count.count }));
}

async function gadmNames(gid) {
  const result = await fetchJson(API.replace('limit=0', 'limit=1') + '&gadmGid=' + gid);
  const gadm = result.results[0]?.gadm ?? {};
  return { level1: gadm.level1?.name, level2: gadm.level2?.name, level1Gid: gadm.level1?.gid };
}

async function speciesIn(gid, kind) {
  const counts = await facet('&gadmGid=' + gid + '&kingdomKey=' + KINGDOM_KEYS[kind], 'speciesKey');
  return counts.map(count => Number(count.name));
}

async function main() {
  const { provinces, districts } = await loadAtlas();
  const codeByName = new Map(provinces.map(province => [squash(province.name), province.code]));
  // GADM and the atlas spell a few provinces differently.
  const ALIASES = { jakartaraya: '31', yogyakarta: '34', bangkabelitung: '19', riauislands: '21', daerahistimewayogyakarta: '34', dkijakarta: '31', kepulauanbangkabelitung: '19', kepulauanriau: '21' };

  const gids = (await facet('', 'gadmGid')).map(item => item.name);
  const levelOne = gids.filter(gid => /^IDN\.\d+_1$/.test(gid));
  console.log('Level-1 GADM units:', levelOne.length);

  const presence = new Map();
  const add = (key, code) => {
    presence.set(key, new Set([...(presence.get(key) ?? []), code]));
  };
  const report = { unmatched: [], papuaUnplaced: [], perProvince: {} };

  for (const gid of levelOne) {
    const names = await gadmNames(gid);
    const source = squash(names.level1 ?? '');
    const tally = code => { report.perProvince[code] = (report.perProvince[code] ?? 0) + 1; };

    if (SPLIT_SOURCE_PROVINCES[source]) {
      const candidates = SPLIT_SOURCE_PROVINCES[source];
      const subunits = (await facet('&gadmGid=' + gid, 'gadmGid')).map(item => item.name).filter(item => /^IDN\.\d+\.\d+_1$/.test(item));
      for (const sub of subunits) {
        const subNames = await gadmNames(sub);
        const district = squash((subNames.level2 ?? '').replace(/^(Kabupaten|Kota)\s+/, ''));
        const placed = candidates.filter(code => districts.get(code).includes(district));
        const targets = placed.length > 0 ? placed : Object.values(SPLIT_SOURCE_PROVINCES).flat().filter(code => districts.get(code).includes(district));
        if (targets.length === 0) { report.papuaUnplaced.push(subNames.level2); continue; }
        for (const kind of Object.keys(KINGDOM_KEYS)) {
          for (const key of await speciesIn(sub, kind)) for (const code of targets) add(key, code);
        }
      }
      console.log('Split province', names.level1, 'subunits', subunits.length);
      continue;
    }

    const code = codeByName.get(source) ?? ALIASES[source];
    if (!code) { report.unmatched.push(names.level1 + ' ' + gid); continue; }
    for (const kind of Object.keys(KINGDOM_KEYS)) {
      for (const key of await speciesIn(gid, kind)) add(key, code);
    }
    tally(code);
    console.log(names.level1, '->', code);
  }

  const output = Object.fromEntries([...presence.entries()].map(([key, codes]) => [key, [...codes].sort()]));
  await writeCache('gbif-provinces.json', output);
  console.log('Species with a province:', presence.size);
  console.log('Unmatched provinces:', JSON.stringify(report.unmatched));
  console.log('Unplaced Papua districts:', JSON.stringify(report.papuaUnplaced));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

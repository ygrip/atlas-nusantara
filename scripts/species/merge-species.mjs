// Merges every cached source into the static flora and fauna data, laid out like the destinations catalog:
//   static/data/<kind>/index.json            compact totals, coverage and one summary per province
//   static/data/<kind>/provinces/<code>.json complete species records for one province (loaded on demand)
//   static/data/<kind>/national.json         the whole Indonesia aggregate, offered as a download only
// Usage: node scripts/species/merge-species.mjs [outputRoot=static/data]
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isSpeciesCatalog, isSpeciesIndex, isSpeciesRecord, MAX_SPECIES_IMAGES, SPECIES_STATUSES, THREATENED_STATUSES } from '../../src/lib/data/species-validation.js';
import { loadAllSpecies, makeKeyResolver, readCache } from './common.mjs';

const OUTPUT_ROOT = process.argv[2] ?? 'static/data';
const PROVINCE_CODES = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];
const SUMMARY_LIMIT = 320;
const HABITAT_LIMIT = 400;

const FAUNA_GROUP_BY_CLASS = {
  Mammalia: 'mammals', Aves: 'birds',
  Squamata: 'reptiles', Testudines: 'reptiles', Crocodylia: 'reptiles', Reptilia: 'reptiles', Sphenodontia: 'reptiles',
  Amphibia: 'amphibians',
  Elasmobranchii: 'fishes', Holocephali: 'fishes', Actinopterygii: 'fishes', Cephalaspidomorphi: 'fishes', Petromyzonti: 'fishes', Myxini: 'fishes', Sarcopterygii: 'fishes',
  Insecta: 'insects', Arachnida: 'arachnids',
  Malacostraca: 'crustaceans', Copepoda: 'crustaceans', Maxillopoda: 'crustaceans', Ostracoda: 'crustaceans', Branchiopoda: 'crustaceans', Thecostraca: 'crustaceans', Hexanauplia: 'crustaceans',
  Gastropoda: 'molluscs', Bivalvia: 'molluscs', Cephalopoda: 'molluscs', Polyplacophora: 'molluscs', Scaphopoda: 'molluscs',
  Anthozoa: 'cnidarians', Hydrozoa: 'cnidarians', Scyphozoa: 'cnidarians', Cubozoa: 'cnidarians'
};
const FLORA_GROUP_BY_CLASS = {
  Magnoliopsida: 'flowering', Liliopsida: 'flowering',
  Pinopsida: 'conifers', Cycadopsida: 'conifers', Gnetopsida: 'conifers', Ginkgoopsida: 'conifers',
  Polypodiopsida: 'ferns', Lycopodiopsida: 'ferns'
};
const FLORA_GROUP_BY_PHYLUM = { Bryophyta: 'mosses', Marchantiophyta: 'mosses', Anthocerotophyta: 'mosses', Rhodophyta: 'algae', Chlorophyta: 'algae', Charophyta: 'algae' };

function groupOf(item) {
  if (item.kind === 'fauna') {
    // GBIF leaves the class of ray-finned fishes empty; they are the only classless chordates in the checklist.
    if (item.phylum === 'Chordata' && !item.class) return 'fishes';
    return FAUNA_GROUP_BY_CLASS[item.class] ?? 'other-animals';
  }
  return FLORA_GROUP_BY_CLASS[item.class] ?? FLORA_GROUP_BY_PHYLUM[item.phylum] ?? 'other-plants';
}

function shorten(text, limit) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastStop = cut.lastIndexOf('. ');
  if (lastStop > limit / 3) return cut.slice(0, lastStop + 1);
  return cut.trimEnd() + '…';
}

function statusFrom(code) {
  const upper = String(code ?? '').toUpperCase();
  if (SPECIES_STATUSES.includes(upper) && upper !== 'NE') return upper;
  return '';
}

function listingStatus(listing) {
  const match = /\b(EX|EW|CR|EN|VU|NT|LC|DD)-IUCN/.exec(listing ?? '');
  if (match) return match[1];
  return '';
}

function citesAppendix(text) {
  const match = /^(III|II|I)$/.exec(String(text ?? '').replace(/appendix\s*/i, '').trim());
  if (match) return match[1];
  return undefined;
}

/** Index every enrichment source by backbone GBIF key (KSDAE) or by normalised scientific name. */
function indexSources(sources, keyFor) {
  const byKey = (items, resolveKey) => {
    const map = new Map();
    for (const item of items ?? []) {
      const key = resolveKey(item);
      if (key && !map.has(key)) map.set(key, item);
    }
    return map;
  };
  return {
    awm: byKey(sources.awm, item => keyFor(item.scientificName)),
    earth: byKey(sources.earth, item => keyFor(item.scientificName)),
    ksdae: byKey(sources.ksdae, item => item.gbifKey ?? keyFor(item.scientificName))
  };
}

function buildRecord(item, context) {
  const { provinces, gbif, inat, awm, earth, ksdae } = context;
  const key = item.gbifKey;
  const sources = ['gbif'];
  const inatRecord = inat[key];
  const awmRecord = awm.get(key);
  const earthRecord = earth.get(key);
  const ksdaeRecord = ksdae.get(key);
  if (ksdaeRecord) sources.push('ksdae');
  if (inatRecord) sources.push('inaturalist');
  if (awmRecord) sources.push('animalworldmap');
  if (earthRecord) sources.push('earthsendangered');

  const status = statusFrom(gbif[key]?.iucn) || statusFrom(inatRecord?.iucn) || statusFrom(ksdaeRecord?.iucn)
    || statusFrom(awmRecord?.iucn) || listingStatus(earthRecord?.status) || 'NE';
  const nameEn = inatRecord?.commonNameEn || awmRecord?.commonName || '';
  let name = ksdaeRecord?.localName ?? '';
  // iNaturalist falls back to the English name when no Indonesian one exists; that is not a local name.
  if (!name && inatRecord?.commonNameId && inatRecord.commonNameId !== inatRecord.commonNameEn) name = inatRecord.commonNameId;

  let summary = '';
  let summaryLanguage;
  if (inatRecord?.summary) {
    summary = shorten(inatRecord.summary, SUMMARY_LIMIT);
    summaryLanguage = inatRecord.summaryLanguage;
  } else if (awmRecord?.about) {
    summary = shorten(awmRecord.about, SUMMARY_LIMIT);
    summaryLanguage = 'en';
  }

  const record = {
    id: String(key), scientificName: item.name, name, nameEn, group: groupOf(item), family: item.family, status,
    realms: gbif[key]?.realms ?? [], habitat: shorten(awmRecord?.habitat ?? '', HABITAT_LIMIT), summary,
    provinces: provinces[key] ?? [], sources
  };
  if (summaryLanguage) record.summaryLanguage = summaryLanguage;
  const aliases = (earthRecord?.otherNames ?? '').split(',').map(alias => alias.trim()).filter(alias => alias && alias.toLowerCase() !== 'n/a');
  if (aliases.length > 0) record.aliases = aliases.slice(0, 20);
  if (ksdaeRecord) record.protected = true;
  const cites = citesAppendix(ksdaeRecord?.cites);
  if (cites) record.cites = cites;
  if (earthRecord?.status) record.listing = earthRecord.status.slice(0, 200);
  if (inatRecord?.photos?.length > 0) record.images = inatRecord.photos.slice(0, MAX_SPECIES_IMAGES).map(cleanPhoto);
  if (inatRecord?.wikipediaUrl) record.wikipediaUrl = inatRecord.wikipediaUrl.replace(/^http:/, 'https:');
  if (item.gbifRecords) record.records = item.gbifRecords;
  return record;
}

/** Some iNaturalist authors write a whole biography in the name field; keep the first words only. */
function cleanPhoto(photo) {
  const credit = photo.credit.replace(/["\s]+/g, ' ').trim();
  return { ...photo, credit: shorten(credit, 80).replace(/…$/, '') };
}

function compareRecords(left, right) {
  const byStatus = SPECIES_STATUSES.indexOf(left.status) - SPECIES_STATUSES.indexOf(right.status);
  if (byStatus !== 0) return byStatus;
  const byRecords = (right.records ?? 0) - (left.records ?? 0);
  if (byRecords !== 0) return byRecords;
  return left.scientificName.localeCompare(right.scientificName, 'en');
}

function countBy(records, pick) {
  const counts = {};
  for (const record of records) counts[pick(record)] = (counts[pick(record)] ?? 0) + 1;
  return counts;
}

async function writeJson(filename, value) {
  await writeFile(filename + '.partial', JSON.stringify(value) + '\n');
  await rename(filename + '.partial', filename);
}

function buildIndex(kind, records, fetchedAt) {
  const base = '/data/' + kind + '/';
  const provinces = PROVINCE_CODES.map(code => {
    const inProvince = records.filter(record => record.provinces.includes(code));
    return {
      provinceCode: code, count: inProvince.length, threatened: inProvince.filter(record => THREATENED_STATUSES.includes(record.status)).length,
      withImage: inProvince.filter(record => record.images).length, shard: base + 'provinces/' + code + '.json'
    };
  });
  const scopeKind = kind === 'fauna' ? 'animal' : 'plant';
  return {
    schemaVersion: 1, kind, fetchedAt,
    scope: 'Every ' + scopeKind + ' species recorded in Indonesia in the GBIF-based SC_indonesia checklist (' + records.length + ' species), enriched with KSDAE protected lists, iNaturalist, Animal World Map and Earth\'s Endangered Creatures. Provinces come from GBIF occurrence records (GADM boundaries; the Papua provinces from district names), so a species is listed where it was recorded, not for its whole range. Fungi, bacteria and other kingdoms are not included.',
    license: 'Facts compiled from open biodiversity sources (GBIF CC0/CC BY 4.0 records). Photographs stay on iNaturalist under their owners\' licences and are linked with credit, not redistributed.',
    attribution: 'GBIF.org occurrence download https://doi.org/10.15468/dl.vd2ajk via Encyclopedia of Life; Direktorat Jenderal KSDAE, Kementerian Kehutanan; iNaturalist contributors; Animal World Map; Earth\'s Endangered Creatures.',
    national: base + 'national.json',
    sources: [
      { name: 'SC_indonesia species checklist (EOL / GBIF)', url: 'https://doi.org/10.15468/dl.vd2ajk' },
      { name: 'GBIF', url: 'https://www.gbif.org' },
      { name: 'KSDAE protected species', url: 'https://ksdae.kehutanan.go.id/spesies/' + kind + '/' },
      { name: 'iNaturalist', url: 'https://www.inaturalist.org/places/indonesia' },
      { name: 'Animal World Map', url: 'https://animalworldmap.com/animals/in/indonesia' },
      { name: 'Earth\'s Endangered Creatures', url: 'https://www.earthsendangered.com/search-regions3.asp?mp=&search=1&sgroup=allgroups&ID=168' }
    ],
    coverage: {
      totalSpecies: records.length, withoutProvince: records.filter(record => record.provinces.length === 0).length,
      withImage: records.filter(record => record.images).length, withCommonName: records.filter(record => record.name || record.nameEn).length,
      withSummary: records.filter(record => record.summary).length, withHabitat: records.filter(record => record.habitat).length,
      withStatus: records.filter(record => record.status !== 'NE').length, threatened: records.filter(record => THREATENED_STATUSES.includes(record.status)).length,
      protectedSpecies: records.filter(record => record.protected).length
    },
    statusCounts: countBy(records, record => record.status), groupCounts: countBy(records, record => record.group), provinces
  };
}

/** Names the first record that fails validation, so a bad source value is easy to find. */
function describeInvalid(records) {
  const bad = records.find(record => !isSpeciesRecord(record));
  if (!bad) return 'duplicate ids or province mismatch';
  return JSON.stringify(bad).slice(0, 400);
}

async function writeKind(kind, records, fetchedAt) {
  const directory = path.join(OUTPUT_ROOT, kind);
  await mkdir(path.join(directory, 'provinces'), { recursive: true });
  const index = buildIndex(kind, records, fetchedAt);
  if (!isSpeciesIndex(index, kind)) throw new Error('Invalid ' + kind + ' index');
  for (const code of PROVINCE_CODES) {
    const shard = { schemaVersion: 1, kind, fetchedAt, provinceCode: code, species: records.filter(record => record.provinces.includes(code)) };
    if (!isSpeciesCatalog(shard, kind)) throw new Error('Invalid ' + kind + ' shard ' + code + ': ' + describeInvalid(shard.species));
    await writeJson(path.join(directory, 'provinces', code + '.json'), shard);
  }
  const national = { schemaVersion: 1, kind, fetchedAt, provinceCode: null, species: records };
  if (!isSpeciesCatalog(national, kind)) throw new Error('Invalid ' + kind + ' national file');
  await writeJson(path.join(directory, 'national.json'), national);
  // Publish the index last so it never points at files that have not been written.
  await writeJson(path.join(directory, 'index.json'), index);
  return index;
}

async function main() {
  const species = await loadAllSpecies();
  const missing = [];
  const load = async (name, required) => {
    const value = await readCache(name);
    if (value === undefined && required) missing.push(name);
    return value;
  };
  const provinces = await load('gbif-provinces.json', true) ?? {};
  const gbif = await load('gbif-species.json', false) ?? {};
  const inat = await load('inat.json', false) ?? {};
  const sources = { ksdae: await load('ksdae.json', false), awm: await load('awm.json', false), earth: await load('earthsendangered.json', false) };
  if (missing.length > 0) throw new Error('Missing cache files: ' + missing.join(', '));
  console.log('Optional sources present:', JSON.stringify({ gbifSpecies: Object.keys(gbif).length, inat: Object.keys(inat).length, ksdae: sources.ksdae?.length, awm: sources.awm?.length, earth: sources.earth?.length }));

  const keyFor = makeKeyResolver(species, (await readCache('name-resolution.json')) ?? {});
  const context = { provinces, gbif, inat, ...indexSources(sources, keyFor) };
  const fetchedAt = new Date().toISOString();
  for (const kind of ['flora', 'fauna']) {
    const records = species.filter(item => item.kind === kind).map(item => buildRecord(item, context)).sort(compareRecords);
    const index = await writeKind(kind, records, fetchedAt);
    console.log(kind, JSON.stringify(index.coverage), JSON.stringify(index.statusCounts));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

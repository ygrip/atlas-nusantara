import { isProvinceCodeValue } from './destination-validation.js';

/** @typedef {import('./species-contract').SpeciesRecord} SpeciesRecord */
/** @typedef {import('./species-contract').SpeciesCatalog} SpeciesCatalog */
/** @typedef {import('./species-contract').SpeciesIndex} SpeciesIndex */

export const SPECIES_KINDS = ['flora', 'fauna'];
/** Worst first: extinct, then threatened, then the rest. NE means no category was found in any source. */
export const SPECIES_STATUSES = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'];
export const THREATENED_STATUSES = ['CR', 'EN', 'VU'];
export const FAUNA_GROUPS = ['mammals', 'birds', 'reptiles', 'amphibians', 'fishes', 'insects', 'arachnids', 'crustaceans', 'molluscs', 'cnidarians', 'other-animals'];
export const FLORA_GROUPS = ['flowering', 'conifers', 'ferns', 'mosses', 'algae', 'other-plants'];
const REALMS = ['marine', 'freshwater', 'terrestrial'];
const SPECIES_SOURCES = ['gbif', 'ksdae', 'inaturalist', 'animalworldmap', 'earthsendangered'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
export const MAX_SPECIES_IMAGES = 4;

/** @param {unknown} value @param {number} limit */
function isText(value, limit) {
  return typeof value === 'string' && value.length <= limit;
}

/** @param {unknown} value */
function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** @param {unknown} value */
export function isSpeciesImage(value) {
  if (!value || typeof value !== 'object') return false;
  const image = /** @type {Record<string, unknown>} */ (value);
  if (!Number.isSafeInteger(image.id) || /** @type {number} */ (image.id) <= 0) return false;
  if (!IMAGE_EXTENSIONS.includes(/** @type {string} */ (image.ext))) return false;
  if (!isText(image.credit, 120)) return false;
  return typeof image.license === 'string' && /^[a-z0-9-]{0,20}$/.test(image.license);
}

/** @param {unknown} value @returns {value is SpeciesRecord} */
export function isSpeciesRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const item = /** @type {Record<string, unknown>} */ (value);
  if (typeof item.id !== 'string' || !/^\d{1,12}$/.test(item.id)) return false;
  if (typeof item.scientificName !== 'string' || !item.scientificName.trim() || item.scientificName.length > 200) return false;
  if (!isText(item.name, 200) || !isText(item.nameEn, 200) || !isText(item.family, 100)) return false;
  if (!FAUNA_GROUPS.includes(/** @type {string} */ (item.group)) && !FLORA_GROUPS.includes(/** @type {string} */ (item.group))) return false;
  if (!SPECIES_STATUSES.includes(/** @type {string} */ (item.status))) return false;
  if (!Array.isArray(item.provinces) || !item.provinces.every(isProvinceCodeValue) || new Set(item.provinces).size !== item.provinces.length) return false;
  if (!Array.isArray(item.realms) || !item.realms.every(realm => REALMS.includes(realm))) return false;
  if (!Array.isArray(item.sources) || item.sources.length < 1 || !item.sources.every(source => SPECIES_SOURCES.includes(source))) return false;
  if (!isText(item.habitat, 600) || !isText(item.summary, 700)) return false;
  if (item.summary !== '' && !['id', 'en'].includes(/** @type {string} */ (item.summaryLanguage))) return false;
  if (item.protected !== undefined && item.protected !== true) return false;
  if (item.cites !== undefined && !/^(I|II|III)$/.test(/** @type {string} */ (item.cites))) return false;
  if (item.aliases !== undefined && (!Array.isArray(item.aliases) || item.aliases.length > 20 || !item.aliases.every(alias => isText(alias, 200)))) return false;
  if (item.listing !== undefined && !isText(item.listing, 200)) return false;
  if (item.images !== undefined && (!Array.isArray(item.images) || item.images.length < 1 || item.images.length > MAX_SPECIES_IMAGES || !item.images.every(isSpeciesImage))) return false;
  if (item.wikipediaUrl !== undefined && !isHttpsUrl(item.wikipediaUrl)) return false;
  if (item.records !== undefined && !(Number.isSafeInteger(item.records) && /** @type {number} */ (item.records) >= 0)) return false;
  return true;
}

/** @param {unknown} value @param {string} [kind] @returns {value is SpeciesCatalog} */
export function isSpeciesCatalog(value, kind) {
  if (!value || typeof value !== 'object') return false;
  const catalog = /** @type {Partial<SpeciesCatalog>} */ (value);
  if (catalog.schemaVersion !== 1 || !SPECIES_KINDS.includes(/** @type {string} */ (catalog.kind))) return false;
  if (kind !== undefined && catalog.kind !== kind) return false;
  if (typeof catalog.fetchedAt !== 'string' || !Number.isFinite(Date.parse(catalog.fetchedAt))) return false;
  if (typeof catalog.provinceCode !== 'string' && catalog.provinceCode !== null) return false;
  if (typeof catalog.provinceCode === 'string' && !isProvinceCodeValue(catalog.provinceCode)) return false;
  if (!Array.isArray(catalog.species) || catalog.species.length > 60000) return false;
  const ids = new Set();
  for (const item of catalog.species) {
    if (!isSpeciesRecord(item) || ids.has(item.id)) return false;
    if (catalog.provinceCode && !item.provinces.includes(catalog.provinceCode)) return false;
    ids.add(item.id);
  }
  return true;
}

/** @param {unknown} counts */
function isCountMap(counts) {
  return Boolean(counts) && typeof counts === 'object'
    && Object.values(/** @type {Record<string, unknown>} */ (counts)).every(count => Number.isSafeInteger(count) && /** @type {number} */ (count) >= 0);
}

/** @param {unknown} value @param {string} [kind] @returns {value is SpeciesIndex} */
export function isSpeciesIndex(value, kind) {
  if (!value || typeof value !== 'object') return false;
  const index = /** @type {Partial<SpeciesIndex>} */ (value);
  if (index.schemaVersion !== 1 || !SPECIES_KINDS.includes(/** @type {string} */ (index.kind))) return false;
  if (kind !== undefined && index.kind !== kind) return false;
  if (typeof index.fetchedAt !== 'string' || !Number.isFinite(Date.parse(index.fetchedAt))) return false;
  if (![index.scope, index.license, index.attribution].every(text => typeof text === 'string' && text.trim())) return false;
  const base = '/data/' + index.kind + '/';
  if (index.national !== undefined && index.national !== base + 'national.json') return false;
  if (!Array.isArray(index.sources) || index.sources.length < 1 || !index.sources.every(source => source && typeof source.name === 'string' && isHttpsUrl(source.url))) return false;
  if (!Array.isArray(index.provinces) || index.provinces.length !== 38) return false;
  const codes = new Set();
  for (const province of index.provinces) {
    if (!province || !isProvinceCodeValue(province.provinceCode) || codes.has(province.provinceCode)) return false;
    if (![province.count, province.threatened, province.withImage].every(count => Number.isSafeInteger(count) && count >= 0)) return false;
    if (province.threatened > province.count || province.withImage > province.count) return false;
    if (province.shard !== base + 'provinces/' + province.provinceCode + '.json') return false;
    codes.add(province.provinceCode);
  }
  const coverage = index.coverage;
  if (!coverage || !Object.values(coverage).every(count => Number.isSafeInteger(count) && /** @type {number} */ (count) >= 0)) return false;
  if (!isCountMap(index.statusCounts) || !isCountMap(index.groupCounts)) return false;
  return true;
}

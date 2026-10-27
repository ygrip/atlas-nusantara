import { isReusablePhotoMetadata } from './photo-license.js';

/** @typedef {import('./destination-contract').Landmark} Landmark */
/** @typedef {import('./destination-contract').DestinationCatalog} DestinationCatalog */
/** @typedef {import('./destination-index').DestinationIndex} DestinationIndex */

/** @param {unknown} value @returns {value is string} */
export function isProvinceCodeValue(value) {
  return typeof value === 'string' && /^(1[1-9]|21|3[1-6]|5[1-3]|6[1-5]|7[1-6]|8[1-2]|9[1-6])$/.test(value);
}

/** @param {unknown} value @returns {value is Landmark} */
export function isDestinationRecord(value) {
  if (!value || typeof value !== 'object') return false;
  const item = /** @type {Record<string, unknown>} */ (value);
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)
    || !isProvinceCodeValue(item.provinceCode)
    || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
    || typeof item.kind !== 'string' || !['natural', 'built', 'unknown'].includes(item.kind)) return false;
  if (item.officialId !== undefined && (typeof item.officialId !== 'string' || item.officialId.length > 300)) return false;
  if (item.sourceDistrict !== undefined && (typeof item.sourceDistrict !== 'string' || item.sourceDistrict.length > 300)) return false;
  if ((item.lon === undefined) !== (item.lat === undefined)) return false;
  if (item.lon !== undefined && (typeof item.lon !== 'number' || typeof item.lat !== 'number'
    || !Number.isFinite(item.lon) || !Number.isFinite(item.lat) || Math.abs(item.lon) > 180 || Math.abs(item.lat) > 90)) return false;
  if (item.commonsFile !== undefined && (typeof item.commonsFile !== 'string' || !/^File:[^<>]{1,220}$/.test(item.commonsFile))) return false;
  if (item.image !== undefined && !isReusablePhotoMetadata(item.image)) return false;
  if (item.sourceUrl !== undefined && (typeof item.sourceUrl !== 'string' || !item.sourceUrl.startsWith('https://'))) return false;
  return true;
}

/** Same contract for offline maintenance and browser reads.
 * @param {unknown} value @returns {value is DestinationCatalog}
 */
export function isDestinationCatalog(value) {
  if (!value || typeof value !== 'object') return false;
  const catalog = /** @type {Partial<DestinationCatalog>} */ (value);
  if (catalog.schemaVersion !== 1 || typeof catalog.fetchedAt !== 'string'
    || !Number.isFinite(Date.parse(catalog.fetchedAt)) || typeof catalog.source !== 'string'
    || typeof catalog.scope !== 'string' || typeof catalog.sourceUrl !== 'string'
    || !Array.isArray(catalog.landmarks) || catalog.landmarks.length > 50000) return false;
  const ids = new Set();
  for (const item of catalog.landmarks) {
    if (!isDestinationRecord(item) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

/** @param {unknown} value @returns {value is DestinationIndex} */
export function isDestinationIndex(value) {
  if (!value || typeof value !== 'object') return false;
  const index = /** @type {Partial<DestinationIndex>} */ (value);
  if (index.schemaVersion !== 2 || typeof index.fetchedAt !== 'string' || !Number.isFinite(Date.parse(index.fetchedAt))) return false;
  if (![index.source, index.scope, index.license, index.attribution].every(text => typeof text === 'string' && text.trim())) return false;
  if (index.national !== undefined && index.national !== '/data/destinations/national.json') return false;
  if (typeof index.sourceUrl !== 'string' || !index.sourceUrl.startsWith('https://')) return false;
  if (!Array.isArray(index.provinces) || index.provinces.length !== 38) return false;
  const codes = new Set();
  let total = 0;
  for (const province of index.provinces) {
    if (!province || !isProvinceCodeValue(province.provinceCode) || codes.has(province.provinceCode)) return false;
    if (![province.count, province.natural, province.built, province.unknown ?? 0].every(count => Number.isSafeInteger(count) && count >= 0)) return false;
    if (province.count !== province.natural + province.built + (province.unknown ?? 0)
      || province.shard !== '/data/destinations/provinces/' + province.provinceCode + '.json') return false;
    codes.add(province.provinceCode);
    total += province.count;
  }
  const coverage = index.coverage;
  if (!coverage || coverage.totalRecords !== total) return false;
  if (![coverage.geocodedRecords, coverage.classifiedRecords, coverage.licensedImages]
    .every(count => Number.isSafeInteger(count) && count >= 0 && count <= total)) return false;
  if (coverage.sourceCoveragePercent !== null && (!Number.isFinite(coverage.sourceCoveragePercent)
    || coverage.sourceCoveragePercent < 0 || coverage.sourceCoveragePercent > 100)) return false;
  return true;
}

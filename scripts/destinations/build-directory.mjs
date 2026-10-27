import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeDestinationCatalog } from './catalog-output.mjs';

const LICENSE_NOTE = 'Factual source-linked index; source reuse terms unspecified. Descriptions and photographs are not republished.';
const SOURCE_NOTE = 'Factual names, official IDs and verified source locations only; source redistribution terms are unverified.';
const LEGACY_PAPUA_NAMES = new Set(['papua', 'papua barat']);
const COUNTRY_CODE_PATTERN = /^(1[1-9]|21|3[1-6]|5[1-3]|6[1-5]|7[1-6]|8[1-2]|9[1-6])$/;

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function provinceNameKey(value) {
  let key = cleanText(value).toLocaleLowerCase('id-ID');
  if (key === 'dki jakarta' || key === 'dk jakarta' || key === 'jakarta') key = 'daerah khusus ibukota jakarta';
  if (key === 'di yogyakarta' || key === 'yogyakarta') key = 'daerah istimewa yogyakarta';
  return key;
}

function parseGeometryPath(pathText) {
  const rings = [];
  let ring = [];
  for (const command of pathText.match(/[MLZ][^MLZ]*/g) ?? []) {
    if (command[0] === 'Z') {
      if (ring.length > 2) rings.push(ring);
      ring = [];
      continue;
    }
    const [x, y] = command.slice(1).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Pinned province geometry contains invalid path data');
    ring.push([x, y]);
  }
  if (ring.length > 2) rings.push(ring);
  if (!rings.length) throw Error('Pinned province geometry has an empty province');
  return rings;
}

function contains(ring, x, y) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [x1, y1] = ring[current];
    const [x2, y2] = ring[previous];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function sourceCoordinateInProvince(lon, lat, projection, provinces) {
  const lambda = lon * Math.PI / 180;
  const clampedLatitude = Math.max(-1.4844222297453324, Math.min(1.4844222297453324, lat * Math.PI / 180));
  const x = projection.translate[0] + projection.scale * lambda;
  const y = projection.translate[1] - projection.scale * Math.log(Math.tan(Math.PI / 4 + clampedLatitude / 2));
  const matches = [];
  for (const province of provinces) {
    const [minX, minY, maxX, maxY] = province.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    let inside = false;
    for (const ring of province.rings) {
      if (contains(ring, x, y)) inside = !inside;
    }
    if (inside) matches.push(province.code);
  }
  if (matches.length !== 1) return undefined;
  return matches[0];
}

function prepareGeometry(geometry) {
  if (geometry?.codeEdition !== 'Kepmendagri 300.2.2-2430/2025'
    || geometry.level !== 'province' || !geometry.projection || geometry.regions?.length !== 38) {
    throw Error('Expected pinned 2025 national geometry with all 38 provinces');
  }
  const provinces = geometry.regions.map(region => {
    if (!COUNTRY_CODE_PATTERN.test(region.sourceCode)) throw Error('Invalid province code in pinned geometry');
    const rings = parseGeometryPath(region.path);
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of rings) {
      for (const [x, y] of ring) {
        bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y);
        bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y);
      }
    }
    return { code: region.sourceCode, rings, bbox };
  });
  if (new Set(provinces.map(province => province.code)).size !== 38) throw Error('Pinned geometry contains duplicate provinces');
  return provinces;
}

function category(record) {
  if (record.kind === 'natural' || record.kind === 'built') return record.kind;
  if (record.sourceCategory === 1 || record.sourceCategory === 4) return 'natural';
  if (record.sourceCategory === 2 || record.sourceCategory === 3) return 'built';
  return undefined;
}

function validateUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return undefined;
  return value;
}

function assignNamedProvince(sourceProvince, provinceNameToCode, record, geometry, provinces, modernProvinces) {
  const name = provinceNameKey(sourceProvince);
  if (!name) return { reason: 'missing-province' };
  if (!modernProvinces && LEGACY_PAPUA_NAMES.has(name)) {
    if (!Number.isFinite(record.lon) || !Number.isFinite(record.lat)) return { reason: 'legacy-papua-requires-verified-coordinates' };
    const provinceCode = sourceCoordinateInProvince(record.lon, record.lat, geometry.projection, provinces);
    if (!provinceCode || !provinceCode.startsWith('9')) return { reason: 'legacy-papua-coordinate-ambiguous' };
    return { provinceCode };
  }
  const provinceCode = provinceNameToCode.get(name);
  if (!provinceCode) return { reason: 'unknown-source-province' };
  return { provinceCode };
}

function stableSort(left, right) {
  if (left.provinceCode < right.provinceCode) return -1;
  if (left.provinceCode > right.provinceCode) return 1;
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return left.id.localeCompare(right.id);
}

export function buildDirectoryCatalog(inventory, admin, geometry, generatedAt = inventory?.fetchedAt) {
  if (!inventory || !Array.isArray(inventory.records) || !Number.isSafeInteger(inventory.expectedRecords)
    || inventory.expectedRecords < 0 || typeof inventory.complete !== 'boolean') throw Error('Invalid crawled inventory manifest');
  if (!Number.isFinite(Date.parse(generatedAt))) throw Error('Invalid catalog generation timestamp');
  if (admin?.edition !== 'Kepmendagri 300.2.2-2430/2025' || admin.count !== 38 || admin.regions?.length !== 38) {
    throw Error('Expected the pinned 2025 administrative province directory');
  }
  const provinceNameToCode = new Map();
  for (const region of admin.regions) {
    if (region.level !== 'province' || !COUNTRY_CODE_PATTERN.test(region.code)) throw Error('Invalid province entry in administrative directory');
    const key = provinceNameKey(region.name);
    if (provinceNameToCode.has(key)) throw Error('Duplicate canonical administrative province name: ' + region.name);
    provinceNameToCode.set(key, region.code);
  }
  const provinces = prepareGeometry(geometry);
  const recordsById = new Map();
  const rejectedDuplicates = new Set();
  const quarantine = [];
  for (const sourceRecord of inventory.records) {
    const officialId = cleanText(sourceRecord.officialId);
    if (!officialId) {
      quarantine.push({ officialId: '', reason: 'missing-source-id', sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    const previous = recordsById.get(officialId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(sourceRecord)) {
        rejectedDuplicates.add(officialId);
      }
      continue;
    }
    recordsById.set(officialId, sourceRecord);
  }
  const accepted = [];
  const usedIds = new Set();
  for (const [officialId, sourceRecord] of recordsById) {
    if (rejectedDuplicates.has(officialId)) {
      quarantine.push({ officialId, reason: 'conflicting-duplicate-source-id', sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    let kind = category(sourceRecord);
    if (!kind && inventory.retainUnclassified === true) kind = 'unknown';
    if (!kind) {
      quarantine.push({ officialId, reason: 'unknown-category', sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    const named = assignNamedProvince(sourceRecord.sourceProvince, provinceNameToCode, sourceRecord, geometry, provinces, inventory.provinceEdition === '38-province-source-selector');
    if (!named.provinceCode) {
      quarantine.push({ officialId, reason: named.reason, sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    const id = (inventory.idPrefix ?? 'directory-') + officialId;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || usedIds.has(id)) {
      quarantine.push({ officialId, reason: 'invalid-or-duplicate-output-id', sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    usedIds.add(id);
    const landmark = {
      id,
      officialId,
      provinceCode: named.provinceCode,
      name: cleanText(sourceRecord.name),
      kind,
      sourceCategory: sourceRecord.sourceCategory,
      sourceUrl: validateUrl(sourceRecord.sourceUrl),
      provenanceUrl: validateUrl(sourceRecord.provenanceUrl),
      sourceProvince: cleanText(sourceRecord.sourceProvince),
      sourceProvinceId: sourceRecord.sourceProvinceId,
      sourceDistrictId: sourceRecord.sourceDistrictId,
      sourceDistrict: sourceRecord.sourceDistrict,
      retrievedAt: sourceRecord.retrievedAt,
      coordinateStatus: 'missing'
    };
    if (!landmark.name || landmark.name.length > 200 || !landmark.sourceUrl || !landmark.provenanceUrl) {
      quarantine.push({ officialId, reason: 'invalid-name-or-provenance', sourceProvince: sourceRecord.sourceProvince });
      continue;
    }
    if (Number.isFinite(sourceRecord.lon) && Number.isFinite(sourceRecord.lat)
      && Math.abs(sourceRecord.lon) <= 180 && Math.abs(sourceRecord.lat) <= 90) {
      const coordinateProvince = sourceCoordinateInProvince(sourceRecord.lon, sourceRecord.lat, geometry.projection, provinces);
      if (coordinateProvince === named.provinceCode) {
        landmark.lon = sourceRecord.lon;
        landmark.lat = sourceRecord.lat;
        landmark.coordinateStatus = 'verified-against-pinned-boundary';
      } else {
        landmark.coordinateStatus = 'omitted-source-coordinate-outside-named-province';
      }
    } else if (sourceRecord.lon !== undefined || sourceRecord.lat !== undefined) {
      landmark.coordinateStatus = 'omitted-invalid-source-coordinate';
    }
    if (kind === 'built' && sourceRecord.sourceCategory === 3) landmark.subtype = 'cultural';
    accepted.push(landmark);
  }
  accepted.sort(stableSort);
  quarantine.sort((left, right) => left.officialId.localeCompare(right.officialId) || left.reason.localeCompare(right.reason));

  const summaries = admin.regions.map(region => {
    const provinceRecords = accepted.filter(record => record.provinceCode === region.code);
    return {
      provinceCode: region.code,
      count: provinceRecords.length,
      natural: provinceRecords.filter(record => record.kind === 'natural').length,
      built: provinceRecords.filter(record => record.kind === 'built').length,
      unknown: provinceRecords.filter(record => record.kind === 'unknown').length,
      shard: '/data/destinations/provinces/' + region.code + '.json'
    };
  }).sort((left, right) => left.provinceCode.localeCompare(right.provinceCode));
  const coordinateCount = accepted.filter(record => record.coordinateStatus === 'verified-against-pinned-boundary').length;
  let sourceCoveragePercent = null;
  if (inventory.complete && inventory.expectedRecords > 0) {
    sourceCoveragePercent = Math.min(100, accepted.length / inventory.expectedRecords * 100);
  }
  const index = {
    schemaVersion: 2,
    fetchedAt: generatedAt,
    source: cleanText(inventory.source) || 'Direktori Pariwisata',
    sourceUrl: validateUrl(inventory.sourceUrl) || 'https://www.direktoripariwisata.id/browse?cat=0',
    scope: 'Crawled public directory records; not a complete or independently verified national inventory.',
    license: LICENSE_NOTE,
    attribution: 'Source and per-record directory links are preserved; source reuse terms are unspecified.',
    sourceLicense: null,
    crawlComplete: inventory.complete,
    crawlExpectedRecords: inventory.expectedRecords,
    crawlCollectedRecords: inventory.records.length,
    coverage: {
      totalRecords: accepted.length,
      geocodedRecords: coordinateCount,
      classifiedRecords: accepted.filter(record => record.kind !== 'unknown').length,
      licensedImages: 0,
      sourceCoveragePercent
    },
    provinces: summaries
  };
  const shards = Object.fromEntries(summaries.map(summary => [summary.provinceCode, {
    schemaVersion: 1,
    codeEdition: admin.edition,
    provinceCode: summary.provinceCode,
    source: index.source,
    sourceUrl: index.sourceUrl,
    license: index.license,
    sourceLicense: null,
    attribution: index.attribution,
    retrievedAt: generatedAt,
    fetchedAt: generatedAt,
    scope: index.scope,
    landmarks: accepted.filter(record => record.provinceCode === summary.provinceCode)
  }]));
  return { index, shards, quarantine, report: {
    expectedRecords: inventory.expectedRecords,
    collectedRecords: inventory.records.length,
    indexedRecords: accepted.length,
    geocodedRecords: coordinateCount,
    quarantinedRecords: quarantine.length,
    crawlComplete: inventory.complete,
    sourceCoveragePercent: index.coverage.sourceCoveragePercent
  } };
}

export async function writeDirectoryCatalog({ inventoryPath, adminPath, geometryPath, outputDirectory, generatedAt }) {
  const [inventory, admin, geometry] = await Promise.all([
    readFile(inventoryPath, 'utf8').then(JSON.parse),
    readFile(adminPath, 'utf8').then(JSON.parse),
    readFile(geometryPath, 'utf8').then(JSON.parse)
  ]);
  const built = buildDirectoryCatalog(inventory, admin, geometry, generatedAt ?? inventory.fetchedAt);
  await writeDestinationCatalog(outputDirectory, built.index, built.shards, { quarantine: built.quarantine });
  return built.report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inventoryPath, adminPath, geometryPath, outputDirectory] = process.argv.slice(2);
  if (!inventoryPath || !adminPath || !geometryPath || !outputDirectory) {
    console.error('Usage: node scripts/destinations/build-directory.mjs <inventory.json> <admin-provinces.json> <national-geometry.json> <output-directory>');
    process.exitCode = 2;
  } else {
    try {
      const result = await writeDirectoryCatalog({ inventoryPath, adminPath, geometryPath, outputDirectory });
      console.log(JSON.stringify(result));
      if (!result.crawlComplete || result.quarantinedRecords > 0) process.exitCode = 2;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

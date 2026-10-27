import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildDirectoryCatalog } from './build-directory.mjs';
import { readImageRegistry, applyImageRegistry } from './image-publication.mjs';
import { writeDestinationCatalog } from './catalog-output.mjs';

const SOURCE_URL = 'https://sisparnas.kemenpar.go.id/datapanel';
const ENDPOINT = 'https://sisparnas.kemenpar.go.id/getdata/peta?scope=dtw';

/** Category totals are not per-record assignments. Never infer type from a name or icon. */
export function normalizeSisparnas(raw, retrievedAt) {
  if (!Array.isArray(raw?.factualRecords) || raw.provinceOptions !== 38
    || raw.factualRecords.length !== raw.uniqueIds || !Number.isFinite(Date.parse(retrievedAt))) {
    throw Error('Invalid recovered SISPARNAS factual crawl');
  }
  const ids = new Set();
  const records = raw.factualRecords.map(record => {
    const id = String(record.id);
    if (!/^\d+$/.test(id) || ids.has(id)) throw Error('Invalid or duplicate SISPARNAS destination ID: ' + id);
    ids.add(id);
    const result = { officialId: id, name: record.name, sourceProvince: record.province,
      sourceProvinceId: String(record.provId), sourceDistrictId: String(record.districtId),
      sourceDistrict: record.district, sourceUrl: SOURCE_URL, provenanceUrl: ENDPOINT };
    let recordTimestamp = record.retrievedAt;
    if (recordTimestamp === undefined && raw.timestampBasis !== 'recovered-output') recordTimestamp = retrievedAt;
    if (recordTimestamp !== undefined) {
      if (typeof recordTimestamp !== 'string' || !Number.isFinite(Date.parse(recordTimestamp))) {
        throw Error('Invalid SISPARNAS record retrieval timestamp: ' + id);
      }
      result.retrievedAt = recordTimestamp;
    }
    if ([1, 2, 3].includes(record.sourceCategory)) result.sourceCategory = record.sourceCategory;
    if (record.lat !== '' && record.lng !== '' && record.lat !== null && record.lng !== null) {
      result.lat = Number(record.lat);
      result.lon = Number(record.lng);
    }
    return result;
  });
  return { source: 'Kementerian Pariwisata · SISPARNAS', sourceUrl: SOURCE_URL,
    expectedRecords: raw.nationalAggregateReported, complete: false,
    fetchedAt: retrievedAt, provinceEdition: '38-province-source-selector',
    retainUnclassified: true, idPrefix: 'sisparnas-', records };
}

export function buildSisparnasCatalog(raw, admin, geometry, retrievedAt) {
  const inventory = normalizeSisparnas(raw, retrievedAt);
  const built = buildDirectoryCatalog(inventory, admin, geometry, retrievedAt);
  built.index.scope = 'Public SISPARNAS destination records retrieved from ' + raw.districtsAttempted + ' districts in 38 provinces. '
    + 'The source reports ' + raw.nationalAggregateReported + ' nationally; ' + raw.uniqueIds + ' unique records were returned. '
    + 'Categories are retained only when returned for individual records; unknown categories are not inferred from aggregate totals. '
    + 'Source coordinates outside the named province boundary are omitted, not silently relocated.';
  built.index.attribution = 'Kementerian Pariwisata Republik Indonesia · SISPARNAS; official identifiers and source links retained.';
  built.index.coverage.sourceCoveragePercent = null;
  built.index.crawl = { endpoint: ENDPOINT, requestDefaults: raw.crawlRequestDefaults,
    sourceProvinceOptions: raw.provinceOptions, districtsAttempted: raw.districtsAttempted,
    nationalAggregateReported: raw.nationalAggregateReported, districtAggregateReported: raw.sumExpectedByDistrict,
    returnedUniqueRecords: raw.uniqueIds, mismatchingDistrictCount: raw.partialCountMismatches,
    mismatchExamples: raw.mismatches, mismatchExamplesComplete: raw.districtCountMismatchDetailsComplete === true,
    categoryFilterTotals: raw.categoryFilters, sourceRequestTimestampsUnavailable: raw.timestampBasis === 'recovered-output',
    timestampBasis: raw.timestampBasis ?? 'recorded-crawl-time', recoveredAt: raw.recoveredAt };
  for (const shard of Object.values(built.shards)) {
    shard.scope = built.index.scope;
    shard.attribution = built.index.attribution;
  }
  return built;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inputPath, outputDirectory, provenancePath] = process.argv.slice(2);
  if (!inputPath || !outputDirectory) throw Error('Usage: node scripts/destinations/build-sisparnas.mjs <crawl.json> <output-directory>');
  const [raw, admin, geometry] = await Promise.all([
    readFile(inputPath, 'utf8').then(JSON.parse),
    readFile(new URL('../../static/data/admin-2025/provinces.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../static/data/geometry-2025/national.json', import.meta.url), 'utf8').then(JSON.parse)
  ]);
  let collectedAt = raw.fetchedAt;
  if (!collectedAt) {
    const manifestPath = provenancePath ?? path.join(path.dirname(inputPath), 'provenance.json');
    const provenance = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (provenance.timestampBasis !== 'recovered-output' || !Number.isFinite(Date.parse(provenance.recoveredAt))) {
      throw Error('Recovered crawl requires a stable provenance timestamp');
    }
    raw.timestampBasis = provenance.timestampBasis;
    raw.recoveredAt = provenance.recoveredAt;
    collectedAt = provenance.recoveredAt;
  }
  const built = buildSisparnasCatalog(raw, admin, geometry, collectedAt);
  if (built.quarantine.length) throw Error('SISPARNAS records require review before publishing: ' + built.quarantine.length);
  const imageRegistry = await readImageRegistry(path.join(outputDirectory, 'image-metadata.json'));
  const imageReport = applyImageRegistry(built.index, built.shards, imageRegistry);
  await writeDestinationCatalog(outputDirectory, built.index, built.shards);
  console.log(JSON.stringify({ ...built.report, imageEnrichment: imageReport }));
}

import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readImageRegistry, applyImageRegistry } from './image-publication.mjs';
import { isDestinationCatalog, isDestinationIndex } from '../../src/lib/data/destination-validation.js';
import path from 'node:path';

const NATIONAL_PATH = '/data/destinations/national.json';
const PROVINCE_CODES = ['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96'];

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateCatalog(index, shards) {
  if (!isDestinationIndex(index)) throw Error('Destination index does not satisfy the browser data contract');
  if (!shards || Object.keys(shards).length !== PROVINCE_CODES.length) {
    throw Error('National destination output requires all 38 province summaries and shards');
  }
  const summaries = new Map(index.provinces.map(summary => [summary.provinceCode, summary]));
  if (summaries.size !== PROVINCE_CODES.length || PROVINCE_CODES.some(code => !summaries.has(code) || !shards[code])) {
    throw Error('National destination output has missing or duplicate provinces');
  }
  const ids = new Set();
  const landmarks = [];
  const edition = shards[PROVINCE_CODES[0]]?.codeEdition;
  if (typeof edition !== 'string' || !edition) throw Error('Province shards require a common code edition');
  for (const code of PROVINCE_CODES) {
    const summary = summaries.get(code);
    const shard = shards[code];
    if (!isDestinationCatalog(shard)) throw Error('Invalid province destination data: ' + code);
    if (shard.codeEdition !== edition || shard.provinceCode !== code || shard.landmarks.length !== summary.count) throw Error('Destination shard metadata/count mismatch for province ' + code);
    const counts = { natural: 0, built: 0, unknown: 0 };
    for (const place of shard.landmarks) {
      if (ids.has(place.id)) throw Error('Duplicate national destination ID');
      if (place.provinceCode !== code) throw Error('Destination belongs to a different province than its shard: ' + place.id);
      ids.add(place.id);
      counts[place.kind]++;
      landmarks.push(place);
    }
    if (summary.natural !== counts.natural || summary.built !== counts.built
      || (summary.unknown ?? 0) !== counts.unknown || summary.count !== counts.natural + counts.built + counts.unknown) {
      throw Error('Destination category totals disagree for province ' + code);
    }
  }
  if (landmarks.length !== index.coverage?.totalRecords) throw Error('National destination total disagrees with index coverage');
  if (landmarks.filter(place => place.image).length !== index.coverage.licensedImages) throw Error('Image count disagrees with index coverage');
  landmarks.sort((left, right) => compareText(left.provinceCode, right.provinceCode) || compareText(left.id, right.id));
  return landmarks;
}

async function writeJson(filename, value) {
  await writeFile(filename + '.partial', JSON.stringify(value) + '\n');
  await rename(filename + '.partial', filename);
}

/** Write the compact index, all 38 lazy shards, and the full static national aggregate. */
export async function writeDestinationCatalog(outputDirectory, index, shards, { quarantine } = {}) {
  const landmarks = validateCatalog(index, shards);
  const orderedCodes = [...PROVINCE_CODES];
  const firstShard = shards[orderedCodes[0]];
  const national = {
    schemaVersion: 1,
    codeEdition: firstShard.codeEdition,
    countryCode: 'ID',
    source: index.source,
    sourceUrl: index.sourceUrl,
    license: index.license,
    sourceLicense: index.sourceLicense ?? null,
    attribution: index.attribution,
    retrievedAt: firstShard.retrievedAt,
    fetchedAt: index.fetchedAt,
    scope: index.scope,
    landmarks
  };
  const publishedIndex = { ...index, national: NATIONAL_PATH };
  const provinceDirectory = path.join(outputDirectory, 'provinces');
  await mkdir(provinceDirectory, { recursive: true });
  for (const code of orderedCodes) await writeJson(path.join(provinceDirectory, code + '.json'), shards[code]);
  await writeJson(path.join(outputDirectory, 'national.json'), national);
  if (quarantine !== undefined) await writeJson(path.join(outputDirectory, 'quarantine.json'), quarantine);
  // Publish the index last so it never points at files that have not been written.
  await writeJson(path.join(outputDirectory, 'index.json'), publishedIndex);
  return { index: publishedIndex, national };
}

/** Manual maintenance only: no network, schedule, or destination backend. */
export async function rebuildStaticDestinations(directory) {
  const index = JSON.parse(await readFile(path.join(directory, 'index.json'), 'utf8'));
  const shards = {};
  const summaries = [];
  const all = [];
  for (const code of PROVINCE_CODES) {
    const shard = JSON.parse(await readFile(path.join(directory, 'provinces', code + '.json'), 'utf8'));
    shards[code] = shard;
    if (!isDestinationCatalog(shard)) throw Error('Invalid province catalog: ' + code);
    const places = shard.landmarks;
    all.push(...places);
    summaries.push({ provinceCode: code, count: places.length,
      natural: places.filter(place => place.kind === 'natural').length,
      built: places.filter(place => place.kind === 'built').length,
      unknown: places.filter(place => place.kind === 'unknown').length,
      shard: '/data/destinations/provinces/' + code + '.json' });
  }
  index.provinces = summaries;
  index.coverage.totalRecords = all.length;
  index.coverage.geocodedRecords = all.filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon)).length;
  index.coverage.classifiedRecords = all.filter(place => place.kind !== 'unknown').length;
  index.coverage.licensedImages = all.filter(place => place.image).length;
  const registry = await readImageRegistry(path.join(directory, 'image-metadata.json'));
  const images = applyImageRegistry(index, shards, registry);
  const result = await writeDestinationCatalog(directory, index, shards);
  return { records: result.national.landmarks.length, provinces: summaries.length, images };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.argv[2] ?? fileURLToPath(new URL('../../static/data/destinations/', import.meta.url));
  console.log(JSON.stringify(await rebuildStaticDestinations(directory)));
}

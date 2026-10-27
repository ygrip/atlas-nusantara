import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { photoLicenseUrl } from '../../src/lib/data/photo-license.js';
import { writeDestinationCatalog } from './catalog-output.mjs';

const ALLOWED_LICENSES = new Set(['ODbL-1.0', 'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0']);
const PROVINCE_CODES = new Set(['11','12','13','14','15','16','17','18','19','21','31','32','33','34','35','36','51','52','53','61','62','63','64','65','71','72','73','74','75','76','81','82','91','92','93','94','95','96']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function requireText(value, label, maxLength = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw Error(`Invalid ${label}`);
  return value.trim();
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw Error('Manifest must be an object');
  const source = requireText(manifest.source, 'source name', 120);
  const sourceUrl = requireText(manifest.sourceUrl, 'source URL', 2048);
  const attribution = requireText(manifest.attribution, 'attribution', 500);
  const license = requireText(manifest.license, 'license identifier', 80);
  const retrievedAt = requireText(manifest.retrievedAt, 'retrievedAt', 40);
  if (!/^https:\/\//.test(sourceUrl)) throw Error('sourceUrl must use HTTPS');
  if (!ALLOWED_LICENSES.has(license)) throw Error(`Unsupported license: ${license}`);
  if (!DATE_PATTERN.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) throw Error('retrievedAt must be an ISO UTC timestamp');
  return { source, sourceUrl, attribution, license, retrievedAt };
}

function project(projection, lon, lat) {
  const lambda = lon * Math.PI / 180;
  const phi = Math.max(-1.4844222297453324, Math.min(1.4844222297453324, lat * Math.PI / 180));
  return [projection.translate[0] + projection.scale * lambda, projection.translate[1] - projection.scale * Math.log(Math.tan(Math.PI / 4 + phi / 2))];
}

function parsePath(pathText) {
  const rings = [];
  let ring = [];
  for (const command of pathText.match(/[MLZ][^MLZ]*/g) ?? []) {
    if (command[0] === 'Z') {
      if (ring.length > 2) rings.push(ring);
      ring = [];
    } else {
      const [x, y] = command.slice(1).split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Invalid province geometry path');
      ring.push([x, y]);
    }
  }
  if (ring.length > 2) rings.push(ring);
  return rings;
}

function contains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function provinceFor(point, provinces, projection) {
  const projected = project(projection, point[0], point[1]);
  const matches = provinces.filter(province => {
    let inside = false;
    for (const ring of province.rings) if (contains(ring, projected)) inside = !inside;
    return inside;
  });
  if (matches.length !== 1) throw Error(`Coordinate must match exactly one pinned province; matched ${matches.length}`);
  return matches[0].code;
}

function category(properties) {
  const value = String(properties.category ?? '').trim().toLowerCase();
  if (['natural', 'nature'].includes(value)) return ['natural', 'natural'];
  if (['built', 'human-made', 'human_made'].includes(value)) return ['built', 'built'];
  if (['cultural', 'heritage'].includes(value)) return ['built', 'cultural'];
  throw Error(`Unsupported or missing category: ${value || '(empty)'}`);
}

function stableId(source, identifier) {
  return createHash('sha256').update(source + '\0' + identifier).digest('hex').slice(0, 32);
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalize(features, manifest, geometry) {
  if (!Array.isArray(features) || features.length > 100000) throw Error('Features must be an array of at most 100,000 records');
  if (geometry?.codeEdition !== 'Kepmendagri 300.2.2-2430/2025' || geometry.level !== 'province' || !geometry.projection || geometry.regions?.length !== 38) {
    throw Error('Expected pinned 2025 national geometry with all 38 provinces and projection');
  }
  const provinces = geometry.regions.map(region => {
    if (!PROVINCE_CODES.has(region.sourceCode)) throw Error(`Unknown province code in geometry: ${region.sourceCode}`);
    return { code: region.sourceCode, rings: parsePath(region.path) };
  });
  if (new Set(provinces.map(item => item.code)).size !== 38 || provinces.some(item => item.rings.length === 0)) throw Error('Pinned geometry must contain 38 unique province polygons');
  const seen = new Set();
  const records = features.map(feature => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length < 2) throw Error('Each record must have a Point geometry');
    const [lon, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw Error('Invalid source coordinates');
    const properties = feature.properties;
    if (!properties || typeof properties !== 'object') throw Error('Each record requires properties');
    const officialId = requireText(properties.id, 'official source identifier', 180);
    if (seen.has(officialId)) throw Error(`Duplicate source identifier: ${officialId}`);
    seen.add(officialId);
    const name = requireText(properties.name, 'record name', 200);
    const [kind, subtype] = category(properties);
    const record = {
      id: stableId(manifest.source, officialId), officialId,
      provinceCode: provinceFor(feature.geometry.coordinates, provinces, geometry.projection),
      name, kind, subtype, lon, lat,
      sourceUrl: manifest.sourceUrl,
      source: manifest.source, license: manifest.license,
      attribution: manifest.attribution, retrievedAt: manifest.retrievedAt
    };
    if (properties.sourceUrl !== undefined) record.sourceUrl = requireText(properties.sourceUrl, 'record source URL', 2048);
    if (!/^https:\/\//.test(record.sourceUrl)) throw Error(`Invalid source URL for ${officialId}`);
    if (properties.image !== undefined) {
      const image = properties.image;
      if (!image || typeof image !== 'object' || properties.imageReviewed !== true) throw Error(`Image metadata must be reviewed for ${officialId}`);
      const imageUrl = requireText(image.url, 'image URL', 2048);
      const descriptionUrl = requireText(image.descriptionUrl, 'image description URL', 2048);
      const credit = requireText(image.credit, 'image credit', 500);
      const imageLicense = requireText(image.license, 'image license', 80);
      const licenseUrl = photoLicenseUrl(imageLicense);
      if (!licenseUrl) throw Error(`Unsupported image license for ${officialId}: ${imageLicense}`);
      const reviewedAt = requireText(image.reviewedAt, 'image reviewedAt', 40);
      let imageHost;
      try { imageHost = new URL(imageUrl).hostname; } catch { throw Error(`Invalid image URL for ${officialId}`); }
      if (!imageUrl.startsWith('https://') || imageHost !== 'commons.wikimedia.org' || !new URL(imageUrl).pathname.startsWith('/wiki/Special:FilePath/')) throw Error(`Image URL must use Wikimedia Commons Special:FilePath for ${officialId}`);
      if (!descriptionUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) throw Error(`Image description URL must be a Commons file page for ${officialId}`);
      if (!DATE_PATTERN.test(reviewedAt) || !Number.isFinite(Date.parse(reviewedAt))) throw Error(`Invalid image review timestamp for ${officialId}`);
      record.image = { url: imageUrl, descriptionUrl, credit, license: imageLicense, licenseUrl, reviewedAt };
    }
    return record;
  });
  records.sort((a, b) => compareText(a.provinceCode, b.provinceCode) || compareText(a.name, b.name) || compareText(a.id, b.id));
  return records;
}

export function buildCatalog(features, manifestInput, geometry, generatedAt = manifestInput.retrievedAt) {
  const manifest = validateManifest(manifestInput);
  if (!DATE_PATTERN.test(generatedAt) || !Number.isFinite(Date.parse(generatedAt))) throw Error('generatedAt must be an ISO UTC timestamp');
  const records = normalize(features, manifest, geometry);
  const provinces = [...PROVINCE_CODES].sort().map(code => {
    const provinceRecords = records.filter(record => record.provinceCode === code);
    return {
      provinceCode: code, count: provinceRecords.length,
      natural: provinceRecords.filter(record => record.kind === 'natural').length,
      built: provinceRecords.filter(record => record.kind === 'built').length,
      shard: `/data/destinations/provinces/${code}.json`
    };
  });
  return {
    index: {
      schemaVersion: 2, fetchedAt: generatedAt, source: manifest.source, sourceUrl: manifest.sourceUrl,
      license: manifest.license, attribution: manifest.attribution, scope: 'source records only; not a complete inventory',
      coverage: { totalRecords: records.length, geocodedRecords: records.length, classifiedRecords: records.length, licensedImages: records.filter(item => item.image).length, sourceCoveragePercent: null },
      provinces
    },
    shards: Object.fromEntries([...PROVINCE_CODES].sort().map(code => [code, {
      schemaVersion: 1, codeEdition: geometry.codeEdition, provinceCode: code, source: manifest.source,
      sourceUrl: manifest.sourceUrl, license: manifest.license, attribution: manifest.attribution,
      retrievedAt: manifest.retrievedAt, fetchedAt: generatedAt,
      scope: 'source records only; not a complete inventory', landmarks: records.filter(record => record.provinceCode === code)
    }]))
  };
}

export async function writeCatalog({ inputPath, manifestPath, geometryPath, outputDirectory, generatedAt }) {
  const [input, manifest, geometry] = await Promise.all([
    readFile(inputPath, 'utf8').then(JSON.parse), readFile(manifestPath, 'utf8').then(JSON.parse), readFile(geometryPath, 'utf8').then(JSON.parse)
  ]);
  if (input?.type !== 'FeatureCollection') throw Error('Input must be a GeoJSON FeatureCollection');
  const built = buildCatalog(input.features, manifest, geometry, generatedAt ?? manifest.retrievedAt);
  await writeDestinationCatalog(outputDirectory, built.index, built.shards);
  return { records: built.index.coverage.totalRecords, provinces: Object.keys(built.shards).length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [inputPath, manifestPath, geometryPath, outputDirectory] = process.argv.slice(2);
  if (!inputPath || !manifestPath || !geometryPath || !outputDirectory) {
    console.error('Usage: node scripts/destinations/ingest.mjs <input.geojson> <manifest.json> <geometry-2025/national.json> <output-directory>');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(await writeCatalog({ inputPath, manifestPath, geometryPath, outputDirectory }))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, stat, cp, mkdtemp, rename, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { geoArea, geoMercator, geoPath } from 'd3-geo';
import mapshaper from 'mapshaper';

export const CODE_EDITION = 'Kepmendagri 100.1.1-6117/2022';

export function validateProvenance(provenance) {
  for (const field of ['boundaryEdition', 'codeEdition', 'source', 'license', 'licenseUrl', 'reviewedBy', 'reviewedAt']) {
    if (typeof provenance[field] !== 'string' || !provenance[field].trim()) throw Error('Missing provenance: ' + field);
  }
  if (provenance.codeEdition !== CODE_EDITION) throw Error('Wrong code edition');
  if (!['CC-BY-4.0', 'CC0-1.0', 'ODbL-1.0', 'MIT'].includes(provenance.license)) throw Error('Unapproved redistribution license');
  for (const field of ['source', 'licenseUrl']) {
    if (new URL(provenance[field]).protocol !== 'https:') throw Error('HTTPS provenance required');
  }
  if (!Number.isFinite(Date.parse(provenance.reviewedAt))) throw Error('Invalid provenance review date');
}

export function validateCollection(collection, expectedCodes, label) {
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw Error('Invalid GeoJSON: ' + label);
  const seen = new Set();
  for (const feature of collection.features) {
    const code = feature.properties?.code;
    if (typeof code !== 'string' || !expectedCodes.has(code)) throw Error('Unmatched code in ' + label + ': ' + code);
    if (seen.has(code)) throw Error('Duplicate geometry: ' + code);
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw Error('Polygon required: ' + code);
    validateCoordinates(feature.geometry.coordinates);
    seen.add(code);
  }
  if (seen.size !== expectedCodes.size) throw Error('Incomplete geometry: ' + label);
}

function validateCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) throw Error('Empty coordinates');
  if (typeof coordinates[0] === 'number') {
    if (!Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) throw Error('Invalid longitude/latitude');
    return;
  }
  for (const child of coordinates) validateCoordinates(child);
}

async function simplify(collection) {
  const files = await mapshaper.applyCommands('-i input.geojson -simplify weighted 12% keep-shapes -o output.geojson format=geojson', { 'input.geojson': JSON.stringify(collection) });
  const simplified = JSON.parse(files['output.geojson'].toString());
  // d3 spherical polygons use clockwise exteriors (opposite RFC 7946).
  for (const feature of simplified.features) {
    if (geoArea(feature) > 2 * Math.PI) {
      let polygons = feature.geometry.coordinates;
      if (feature.geometry.type === 'Polygon') polygons = [polygons];
      for (const polygon of polygons) for (const ring of polygon) ring.reverse();
    }
  }
  return simplified;
}

function project(collection, regions, provenance, level) {
  const projection = geoMercator().fitExtent([[24, 24], [976, 476]], collection);
  const path = geoPath(projection).digits(2);
  return {
    schemaVersion: 1, ...provenance, level, viewBox: '0 0 1000 500',
    regions: collection.features.map(feature => {
      const code = feature.properties.code;
      const region = regions.find(item => item.code === code);
      const bounds = path.bounds(feature);
      const svgPath = path(feature);
      if (!svgPath || svgPath.includes('NaN') || bounds.flat().some(value => !Number.isFinite(value))) throw Error('Unprojectable geometry: ' + code);
      return { id: code, sourceCode: code, name: region.name, level, parentId: region.parentCode,
        boundaryEdition: provenance.boundaryEdition, source: provenance.source, path: svgPath, bbox: bounds.flat() };
    })
  };
}

function escapeXml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function writePackage(outputDirectory, name, payload) {
  const target = resolve(outputDirectory, name);
  await mkdir(dirname(target), { recursive: true });
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json) > 2_000_000 || payload.regions.some(region => region.path.length > 200_000)) throw Error('Geometry package exceeds the browser budget; simplify the reviewed input further');
  await writeFile(target + '.json', json);
  const paths = payload.regions.map(region => `<path id="region-${region.sourceCode}" data-code="${region.sourceCode}" d="${region.path}"><title>${escapeXml(region.name)}</title></path>`).join('');
  const depth = payload.regions.map(region => `<use href="#region-${region.sourceCode}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${payload.viewBox}" role="img"><title>${escapeXml(payload.boundaryEdition)}</title><metadata>${escapeXml(JSON.stringify({ source: payload.source, boundaryEdition: payload.boundaryEdition, codeEdition: payload.codeEdition, license: payload.license }))}</metadata><g transform="translate(0 8)" fill="#52745b" stroke="#52745b" aria-hidden="true">${depth}</g><g fill="#91b89b" stroke="#365945" stroke-width="0.7">${paths}</g></svg>`;
  await writeFile(target + '.svg', svg);
}

async function buildGeometryInDirectory({ provinceInput, cityInput, provenanceInput, outputDirectory, adminDirectory, selectedProvince }) {
  const provenance = JSON.parse(await readFile(provenanceInput, 'utf8'));
  validateProvenance(provenance);
  const provinceBytes = await readFile(provinceInput);
  if (createHash('sha256').update(provinceBytes).digest('hex') !== provenance.provinceSha256) throw Error('Source checksum mismatch: provinceSha256');
  const partitionedInput = (await stat(cityInput)).isDirectory();
  const provinceData = JSON.parse(await readFile(resolve(adminDirectory, 'provinces.json'), 'utf8'));
  const cityData = JSON.parse(await readFile(resolve(adminDirectory, 'cities.json'), 'utf8'));
  if (provinceData.edition !== CODE_EDITION || cityData.edition !== CODE_EDITION) throw Error('Administrative seed edition mismatch');
  const provinces = provinceData.regions;
  const cities = cityData.regions;
  if (provinces.length !== 37 || cities.length !== 514 || new Set(provinces.map(region => region.code)).size !== 37 || new Set(cities.map(region => region.code)).size !== 514) throw Error('2022 code edition must contain 37/514 unique regions');
  const provinceCollection = JSON.parse(provinceBytes);
  validateCollection(provinceCollection, new Set(provinces.map(item => item.code)), 'provinces');
  if (selectedProvince && !provinces.some(region => region.code === selectedProvince)) throw Error('Unknown province selection');
  const simplifiedProvinces = await simplify(provinceCollection);
  await writePackage(outputDirectory, 'national', project(simplifiedProvinces, provinces, provenance, 'province'));
  let allCities;
  if (!partitionedInput) {
    const cityBytes = await readFile(cityInput);
    if (createHash('sha256').update(cityBytes).digest('hex') !== provenance.citySha256) throw Error('Source checksum mismatch: citySha256');
    allCities = JSON.parse(cityBytes);
    validateCollection(allCities, new Set(cities.map(item => item.code)), 'cities');
  }
  for (const province of provinces) {
    if (selectedProvince && province.code !== selectedProvince) continue;
    const expectedCities = cities.filter(region => region.parentCode === province.code);
    let collection;
    if (partitionedInput) {
      const bytes = await readFile(resolve(cityInput, province.code + '.geojson'));
      if (createHash('sha256').update(bytes).digest('hex') !== provenance.citySha256?.[province.code]) throw Error('Source checksum mismatch: ' + province.code);
      collection = JSON.parse(bytes);
    } else {
      collection = { type: 'FeatureCollection', features: allCities.features.filter(feature => feature.properties.code.startsWith(province.code + '.')) };
    }
    validateCollection(collection, new Set(expectedCities.map(region => region.code)), province.code);
    const simplified = await simplify(collection);
    await writePackage(outputDirectory, 'provinces/' + province.code, project(simplified, cities, provenance, 'city-regency'));
  }
  await writeFile(resolve(outputDirectory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, ...provenance, counts: { provinces: 37, cities: 514 }, partial: Boolean(selectedProvince), selectedProvince: selectedProvince ?? null }));
}

async function publishDirectory(staged, target) {
  const previous = staged + '-previous';
  let hadPrevious = false;
  try { await rename(target, previous); hadPrevious = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(staged, target); }
  catch (error) {
    if (hadPrevious) await rename(previous, target);
    throw error;
  }
  if (hadPrevious) await rm(previous, { recursive: true });
}

export async function buildGeometry(options) {
  const target = resolve(options.outputDirectory);
  await mkdir(dirname(target), { recursive: true });
  const staged = await mkdtemp(join(dirname(target), '.geometry-stage-'));
  try {
    if (options.selectedProvince) {
      try { await cp(target, staged, { recursive: true }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await buildGeometryInDirectory({ ...options, outputDirectory: staged });
    await publishDirectory(staged, target);
  } finally { await rm(staged, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 3 && !(args.length === 5 && args[3] === '--province')) throw Error('Usage: node scripts/geo/build-geometry.mjs provinces.geojson cities-directory provenance.json [--province 11]');
  await buildGeometry({ provinceInput: args[0], cityInput: args[1], provenanceInput: args[2], selectedProvince: args[4], outputDirectory: 'static/data/geometry-2022', adminDirectory: 'static/data/admin-2022' });
}

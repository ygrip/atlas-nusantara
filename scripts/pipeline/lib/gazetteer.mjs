// Node loader: builds region records with representative points from the tracked 2025 edition files.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGazetteer } from './gazetteer-core.mjs';
import { roundCoordinate } from './text.mjs';

const ADMIN_DIRECTORY = 'static/data/admin-2025';
const GEOMETRY_DIRECTORY = 'static/data/geometry-2025';
function ringArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function parseRings(path) {
  const rings = [];
  for (const chunk of path.split('M').slice(1)) {
    const points = chunk.replace(/Z/g, '').split('L').map(pair => pair.split(',').map(Number)).filter(pair => pair.length === 2 && pair.every(Number.isFinite));
    if (points.length > 2) rings.push(points);
  }
  return rings;
}

/** Centroid of the largest ring, in projected map units. */
export function largestRingCentroid(path) {
  const rings = parseRings(path);
  if (rings.length === 0) return undefined;
  const largest = rings.reduce((best, ring) => (Math.abs(ringArea(ring)) > Math.abs(ringArea(best)) ? ring : best));
  const area = ringArea(largest);
  if (area === 0) return undefined;
  let x = 0;
  let y = 0;
  for (let index = 0; index < largest.length; index++) {
    const [x1, y1] = largest[index];
    const [x2, y2] = largest[(index + 1) % largest.length];
    const cross = x1 * y2 - x2 * y1;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  return { x: x / (6 * area), y: y / (6 * area) };
}

/** Inverts the Mercator parameters shared by the geometry packages (x = tx + k·λ, y = ty − k·ln tan(π/4 + φ/2)). */
export function unproject(projection, point) {
  const [translateX, translateY] = projection.translate;
  const longitude = ((point.x - translateX) / projection.scale) * (180 / Math.PI);
  const latitude = (2 * Math.atan(Math.exp((translateY - point.y) / projection.scale)) - Math.PI / 2) * (180 / Math.PI);
  return { lon: roundCoordinate(longitude), lat: roundCoordinate(latitude) };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadRegionPoints(root, provinceCodes) {
  const points = new Map();
  const national = await readJson(join(root, GEOMETRY_DIRECTORY, 'national.json'));
  for (const region of national.regions) {
    const centroid = largestRingCentroid(region.path);
    if (centroid) points.set(region.sourceCode, unproject(national.projection, centroid));
  }
  for (const provinceCode of provinceCodes) {
    const geometry = await readJson(join(root, GEOMETRY_DIRECTORY, 'provinces', provinceCode + '.json'));
    for (const region of geometry.regions) {
      const centroid = largestRingCentroid(region.path);
      if (centroid) points.set(region.sourceCode, unproject(geometry.projection, centroid));
    }
  }
  return points;
}

/** Region records with a representative point per regency/province, ready for createGazetteer or JSON export. */
export async function loadRegionRecords(root = process.cwd()) {
  const provinces = (await readJson(join(root, ADMIN_DIRECTORY, 'provinces.json'))).regions;
  const cities = (await readJson(join(root, ADMIN_DIRECTORY, 'cities.json'))).regions;
  const points = await loadRegionPoints(root, provinces.map(province => province.code));
  return [...provinces, ...cities].map(region => {
    const record = { code: region.code, name: region.name, level: region.level, parentCode: region.parentCode ?? null };
    const point = points.get(region.code);
    if (point && region.level === 'city-regency') return { ...record, lon: point.lon, lat: point.lat };
    return record;
  });
}

export async function buildGazetteer(root = process.cwd()) {
  return createGazetteer(await loadRegionRecords(root));
}

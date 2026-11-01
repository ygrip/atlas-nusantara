/** Independent original-SVG nonzero boundary verification; no clipping engine is reused. */
import { readFileSync } from 'node:fs';

const renderPath = process.argv[2] ?? 'static/data/history-territories-render.geojson';
const nationalPath = process.argv[3] ?? 'static/data/geometry-2025/national.json';
const frozenOutside = [
  [277.8741487259, 336.4393058182],
  [341.2113516717, 345.351826316],
  [642.2310726392, 171.1150729402]
];
const render = JSON.parse(readFileSync(renderPath, 'utf8'));
const national = JSON.parse(readFileSync(nationalPath, 'utf8'));
const expectedFeatureCount = Number(process.argv[4] ?? render.metadata?.rendered_feature_count ?? render.metadata?.clipped_feature_count ?? render.features.length);
function projectCoordinates(coordinates) {
  if (typeof coordinates[0] === 'number') {
    const [longitude, latitude] = coordinates;
    const lambda = longitude * Math.PI / 180;
    const phi = latitude * Math.PI / 180;
    return [national.projection.translate[0] + national.projection.scale * lambda,
      national.projection.translate[1] - national.projection.scale * Math.log(Math.tan(Math.PI / 4 + phi / 2))];
  }
  return coordinates.map(projectCoordinates);
}
if (process.argv[5] !== '--planar') {
  for (const feature of render.features) feature.geometry.coordinates = projectCoordinates(feature.geometry.coordinates);
}

function parsePath(path) {
  const tokens = path.match(/[MLZ]|-?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/g) ?? [];
  const rings = [];
  let ring = [];
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === 'Z') {
      if (ring.length >= 3) {
        if (!samePoint(ring[0], ring.at(-1))) ring.push([...ring[0]]);
        rings.push(ring);
      }
      ring = [];
      continue;
    }
    if (command !== 'M' && command !== 'L') throw new Error('Unsupported SVG path command: ' + command);
    ring.push([Number(tokens[index++]), Number(tokens[index++])]);
  }
  if (ring.length) throw new Error('Unclosed SVG path ring');
  return rings;
}

function samePoint(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index++) area += cross(ring[index], ring[index + 1]);
  return area / 2;
}

function ringBounds(ring) {
  const xs = ring.map(point => point[0]);
  const ys = ring.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function inBounds(point, bounds) {
  return point[0] >= bounds[0] - 1e-8 && point[0] <= bounds[2] + 1e-8
    && point[1] >= bounds[1] - 1e-8 && point[1] <= bounds[3] + 1e-8;
}
const regions = national.regions.map(region => {
  const rings = parsePath(region.path);
  return { name: region.name, rings, bounds: rings.map(ringBounds) };
});
// Neighboring reference land is a separate published input, not an inferred province.
if (render.metadata?.modern?.context) {
  const context = JSON.parse(readFileSync(render.metadata.modern.context, 'utf8'));
  for (const feature of context.features) {
    let polygons;
    const geometry = projectCoordinates(feature.geometry.coordinates);
    if (feature.geometry.type === 'Polygon') polygons = [geometry];
    else polygons = geometry;
    for (const polygon of polygons) {
      const rings = polygon.map((ring, index) => {
        const area = signedArea(ring);
        if ((index === 0 && area < 0) || (index > 0 && area > 0)) return [...ring].reverse();
        return ring;
      });
      regions.push({ name: feature.properties.name, rings, bounds: rings.map(ringBounds) });
    }
  }
}
const maskSegments = [];
for (const region of regions) for (const ring of region.rings) {
  for (let index = 0; index < ring.length - 1; index++) {
    const a = ring[index], b = ring[index + 1];
    maskSegments.push({ a, b, minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) });
  }
}

function pointOnSegment(point, a, b) {
  const ab = subtract(b, a), ap = subtract(point, a);
  const tolerance = 1e-8 * Math.max(1, Math.hypot(...ab));
  if (Math.abs(cross(ab, ap)) > tolerance) return false;
  const dot = ap[0] * ab[0] + ap[1] * ab[1];
  return dot >= -tolerance && dot <= ab[0] * ab[0] + ab[1] * ab[1] + tolerance;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 2; index < ring.length - 1; previous = index++) {
    const a = ring[index], b = ring[previous];
    if (pointOnSegment(point, a, b)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function insideRegion(point, region) {
  let winding = 0;
  for (let ringIndex = 0; ringIndex < region.rings.length; ringIndex++) {
    if (!inBounds(point, region.bounds[ringIndex])) continue;
    const ring = region.rings[ringIndex];
    for (let index = 0; index < ring.length - 1; index++) {
      const start = ring[index];
      const end = ring[index + 1];
      if (pointOnSegment(point, start, end)) return true;
      const side = (end[0] - start[0]) * (point[1] - start[1]) - (point[0] - start[0]) * (end[1] - start[1]);
      if (start[1] <= point[1] && point[1] < end[1] && side > 0) winding++;
      else if (end[1] <= point[1] && point[1] < start[1] && side < 0) winding--;
    }
  }
  return winding !== 0;
}
function insideMask(point) { return regions.some(region => insideRegion(point, region)); }

const cellSize = 10;
const grid = new Map();
function cellKey(x, y) { return x + ',' + y; }
for (let id = 0; id < maskSegments.length; id++) {
  const segment = maskSegments[id];
  const minX = Math.floor(segment.minX / cellSize), maxX = Math.floor(segment.maxX / cellSize);
  const minY = Math.floor(segment.minY / cellSize), maxY = Math.floor(segment.maxY / cellSize);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    const key = cellKey(x, y);
    let ids = grid.get(key);
    if (!ids) { ids = []; grid.set(key, ids); }
    ids.push(id);
  }
}

function candidatesForEdge(a, b) {
  const ids = new Set();
  const minX = Math.floor(Math.min(a[0], b[0]) / cellSize), maxX = Math.floor(Math.max(a[0], b[0]) / cellSize);
  const minY = Math.floor(Math.min(a[1], b[1]) / cellSize), maxY = Math.floor(Math.max(a[1], b[1]) / cellSize);
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    for (const id of grid.get(cellKey(x, y)) ?? []) ids.add(id);
  }
  return [...ids].filter(id => {
    const segment = maskSegments[id];
    return segment.maxX >= Math.min(a[0], b[0]) && segment.minX <= Math.max(a[0], b[0])
      && segment.maxY >= Math.min(a[1], b[1]) && segment.minY <= Math.max(a[1], b[1]);
  });
}

function intersectionParameters(a, b, c, d) {
  const r = subtract(b, a), s = subtract(d, c), q = subtract(c, a);
  const denominator = cross(r, s);
  const scale = Math.max(1, Math.hypot(...r) * Math.hypot(...s));
  const tolerance = 1e-12 * scale;
  if (Math.abs(denominator) > tolerance) {
    const t = cross(q, s) / denominator, u = cross(q, r) / denominator;
    if (t >= -1e-12 && t <= 1 + 1e-12 && u >= -1e-12 && u <= 1 + 1e-12) return [Math.max(0, Math.min(1, t))];
    return [];
  }
  if (Math.abs(cross(q, r)) > tolerance) return [];
  const lengthSquared = r[0] * r[0] + r[1] * r[1];
  if (lengthSquared === 0) return [];
  const t0 = (q[0] * r[0] + q[1] * r[1]) / lengthSquared;
  const cd = subtract(d, c);
  const t1 = ((c[0] + cd[0] - a[0]) * r[0] + (c[1] + cd[1] - a[1]) * r[1]) / lengthSquared;
  return [t0, t1].filter(t => t >= 0 && t <= 1);
}

let testedSubsegments = 0;
function edgeOutsideIntervals(a, b) {
  const parameters = [0, 1];
  for (const id of candidatesForEdge(a, b)) {
    const mask = maskSegments[id];
    parameters.push(...intersectionParameters(a, b, mask.a, mask.b));
  }
  parameters.sort((a, b) => a - b);
  const unique = parameters.filter((value, index) => index === 0 || value - parameters[index - 1] > 1e-10);
  const outside = [];
  for (let index = 0; index < unique.length - 1; index++) {
    const start = unique[index], end = unique[index + 1];
    if (end - start <= 1e-12) continue;
    testedSubsegments++;
    const middle = (start + end) / 2;
    const point = [a[0] + (b[0] - a[0]) * middle, a[1] + (b[1] - a[1]) * middle];
    if (!insideMask(point)) outside.push({ start, end, point });
  }
  return outside;
}

function geometryPolygons(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error('Unsupported render geometry: ' + geometry?.type);
}
function pointInPolygon(point, polygon) {
  if (!pointInRing(point, polygon[0])) return false;
  for (let index = 1; index < polygon.length; index++) if (pointInRing(point, polygon[index])) return false;
  return true;
}
function* ringInteriorPoints(ring) {
  const ys = ring.map(point => point[1]);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  for (let step = 1; step < 100; step++) {
    const y = minY + (maxY - minY) * step / 100;
    const xs = [];
    for (let index = 0; index < ring.length - 1; index++) {
      const a = ring[index], b = ring[index + 1];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    xs.sort((a, b) => a - b);
    for (let index = 0; index + 1 < xs.length; index += 2) {
      const point = [(xs[index] + xs[index + 1]) / 2, y];
      if (pointInRing(point, ring)) yield point;
    }
  }
}

const holeWitnesses = [
  { region: 'Sumatera Utara', point: [96.42857513416817, 136.739] },
  { region: 'Sumatera Barat', point: [137.18990852994557, 207.7136] },
  { region: 'Jawa Barat', point: [278.5865122340423, 335.5566] },
  { region: 'Sulawesi Utara', point: [642.6151529411766, 170.0406] },
  { region: 'Kepulauan Riau', point: [210.39537186813186, 173.9901] },
  { region: 'Jawa Tengah', point: [350.9159960801394, 347.0645] },
  { region: 'Jawa Tengah', point: [341.4128071428571, 344.9783] }
];
for (const hole of holeWitnesses) {
  if (insideMask(hole.point)) throw new Error('Frozen original SVG hole witness is no longer outside: ' + JSON.stringify(hole));
}

const failures = [];
if ((render.features?.length ?? 0) !== expectedFeatureCount) failures.push({ kind: 'unexpected-feature-count', expected: expectedFeatureCount, actual: render.features?.length ?? 0 });
let checkedEdges = 0;
let checkedIntervals = 0;
let positiveInteriorFeatures = 0;
let nonemptyFeatures = 0;
for (const feature of render.features ?? []) {
  const polygons = geometryPolygons(feature.geometry);
  if (!polygons.length || polygons.some(polygon => !polygon.length || polygon[0].length < 4)) throw new Error('Empty/invalid polygon for ' + JSON.stringify(feature.properties));
  nonemptyFeatures++;
  let hasPositiveInterior = false;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let index = 0; index < ring.length - 1; index++) {
        const a = ring[index], b = ring[index + 1];
        checkedEdges++;
        for (const interval of edgeOutsideIntervals(a, b)) {
          checkedIntervals++;
          failures.push({ kind: 'outside-edge-interval', properties: feature.properties, edge: [a, b], midpoint: interval.point });
        }
      }
      if (!hasPositiveInterior) for (const candidate of ringInteriorPoints(polygon[0])) {
        if (pointInPolygon(candidate, polygon) && insideMask(candidate)) { hasPositiveInterior = true; break; }
      }
    }
  }
  if (hasPositiveInterior) positiveInteriorFeatures++;
}

const holeHits = holeWitnesses.filter(hole => render.features.some(feature => geometryPolygons(feature.geometry).some(polygon => pointInPolygon(hole.point, polygon))));
const frozen = frozenOutside.map(point => ({ point, insideOriginalSvg: insideMask(point), coveredByRender: render.features.some(feature => geometryPolygons(feature.geometry).some(polygon => pointInPolygon(point, polygon))) }));
for (const witness of frozen) if (witness.insideOriginalSvg || witness.coveredByRender) failures.push({ kind: 'frozen-outside-witness', ...witness });
for (const hole of holeHits) failures.push({ kind: 'filled-original-svg-hole', ...hole });

const result = {
  renderPath, expectedFeatureCount, featureCount: render.features?.length ?? 0, nonemptyFeatures, positiveInteriorFeatures,
  maskRegions: regions.length, maskSegments: maskSegments.length, gridCells: grid.size,
  checkedEdges, checkedIntervals: testedSubsegments, outsideEdgeIntervals: failures.filter(x => x.kind === 'outside-edge-interval').length,
  frozenOutsideWitnesses: frozen, originalHoleWitnesses: holeWitnesses, filledHoleCount: holeHits.length,
  failures: failures.slice(0, 20), failureCount: failures.length
};
console.log(JSON.stringify(result));
if (failures.length || positiveInteriorFeatures !== nonemptyFeatures || !nonemptyFeatures) process.exitCode = 1;

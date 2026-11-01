import polygonClipping from 'polygon-clipping';
import { projectLonLat, unprojectToLonLat } from '../../src/lib/map/projection.ts';

function parsePath(path) {
  const tokens = path.match(/[MLZ]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  const rings = [];
  let ring = [];
  let index = 0;
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'Z') {
      if (ring.length >= 3) {
        const first = ring[0];
        const last = ring.at(-1);
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
        rings.push(ring);
      }
      ring = [];
      continue;
    }
    if (command !== 'M' && command !== 'L') throw Error('Unsupported SVG path command: ' + command);
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Invalid SVG path coordinate');
    if (command === 'M' && ring.length > 0) throw Error('Each national path must close rings before a new move');
    ring.push([x, y]);
  }
  if (ring.length > 0) throw Error('National SVG path contains an unclosed ring');
  return rings;
}

function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index++) {
    area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function pointOnSegment(point, start, end) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-8) return false;
  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  return dot >= 0 && dot <= (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 2; index < ring.length - 1; previous = index++) {
    const start = ring[index];
    const end = ring[previous];
    if (pointOnSegment(point, start, end)) return true;
    const crosses = (start[1] > point[1]) !== (end[1] > point[1])
      && point[0] < (end[0] - start[0]) * (point[1] - start[1]) / (end[1] - start[1]) + start[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function groupRings(rings) {
  const ordered = rings.map(ring => ({ ring, area: signedArea(ring) })).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const polygons = [];
  for (const item of ordered) {
    let parent;
    for (const polygon of polygons) {
      if (pointInRing(item.ring[0], polygon[0])) {
        if (!parent || Math.abs(signedArea(polygon[0])) < Math.abs(signedArea(parent[0]))) parent = polygon;
      }
    }
    const isHole = item.area < 0;
    if (!isHole) polygons.push([item.ring]);
    else if (parent) parent.push(item.ring);
    else throw Error('National land mask has an uncontained hole ring');
  }
  return polygons;
}

/** Parse the exact Mercator SVG coastline used by the base-map SVG and 3D land mask. */
export function nationalLandGeoJson(national) {
  const features = [];
  for (const region of national.regions) {
    const rings = parsePath(region.path);
    const polygons = groupRings(rings);
    if (polygons.length === 0) continue;
    // Keep both inputs in the exact SVG plane. Mixing lon/lat land with projected territories destroys the intersection.
    let geometry;
    if (polygons.length === 1) geometry = { type: 'Polygon', coordinates: polygons[0] };
    else geometry = { type: 'MultiPolygon', coordinates: polygons };
    features.push({ type: 'Feature', properties: { code: region.sourceCode, name: region.name }, geometry });
  }
  return { type: 'FeatureCollection', features };
}

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  return geometry.coordinates;
}

/** Each period is independent; overlapping temporal features must not alter Boolean topology. */
export function intersectProjectedTerritories(source, land) {
  const landUnion = polygonClipping.union(...land.features.map(feature => polygonsOf(feature.geometry)));
  const features = [];
  for (const feature of source.features) {
    const coordinates = polygonClipping.intersection(polygonsOf(feature.geometry), landUnion);
    if (coordinates.length === 0) continue;
    features.push({ ...feature, geometry: { type: 'MultiPolygon', coordinates } });
  }
  return { type: 'FeatureCollection', features };
}

/** Clip without simplification; restore RFC 7946 ring winding after inverse Mercator. */
export async function clipHistoricalTerritories(territories, national, projection, clip) {
  const land = nationalLandGeoJson(national);
  const projectedTerritories = {
    type: 'FeatureCollection',
    features: territories.features.map(feature => ({
      ...feature,
      geometry: projectGeometry(feature.geometry, projection)
    }))
  };
  const result = await clip(projectedTerritories, land);
  const features = result.features.filter(feature => feature.geometry !== null).map(feature => ({
    ...feature,
    geometry: inverseGeometry(feature.geometry, projection)
  }));
  return { type: 'FeatureCollection', features };
}

export function projectGeometry(geometry, projection) {
  function projectRing(ring) {
    return ring.map(([lon, lat]) => {
      const point = projectLonLat(projection, lon, lat);
      return [point.x, point.y];
    });
  }
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: geometry.coordinates.map(projectRing) };
  if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(polygon => polygon.map(projectRing)) };
  throw Error('Unsupported historical geometry: ' + geometry.type);
}

export function inverseGeometry(geometry, projection) {
  function inverseRing(ring, isHole) {
    const points = ring.map(([x, y]) => {
      const { lon, lat } = unprojectToLonLat(projection, x, y);
      return [lon, lat];
    });
    // RFC 7946 uses counter-clockwise exteriors and clockwise holes.
    const area = signedArea(points);
    if ((!isHole && area < 0) || (isHole && area > 0)) points.reverse();
    return points;
  }
  function inversePolygon(polygon) {
    return polygon.map((ring, index) => inverseRing(ring, index > 0));
  }
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: inversePolygon(geometry.coordinates) };
  if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(inversePolygon) };
  throw Error('Unsupported clipped geometry: ' + geometry.type);
}

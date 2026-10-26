import { Shape, Path, Vector2 } from 'three';

/** A closed ring of projected map points (SVG coordinates: x right, y down). */
export type Ring = Vector2[];

/** Map units are the SVG viewBox of the national package (1000 × 500). The 3D world centres it on the origin. */
export const MAP_CENTER = { x: 500, y: 250 };

/**
 * Parses the offline-generated d3 path ("M x,y L x,y … Z" per ring) into rings.
 * d3-geo only emits M, L and Z for polygons, so no curve commands are expected.
 */
export function parseRings(path: string): Ring[] {
  const rings: Ring[] = [];
  let current: Ring = [];
  const commands = path.match(/[MLZ][^MLZ]*/g) ?? [];
  for (const command of commands) {
    const type = command[0];
    if (type === 'Z') {
      if (current.length > 2) rings.push(current);
      current = [];
      continue;
    }
    const [x, y] = command.slice(1).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (type === 'M' && current.length > 2) rings.push(current);
    if (type === 'M') current = [];
    current.push(new Vector2(x, y));
  }
  if (current.length > 2) rings.push(current);
  return rings;
}

function signedArea(ring: Ring): number {
  let area = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function containsPoint(ring: Ring, point: Vector2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Converts SVG coordinates to the shape plane used before extrusion (y flipped so the map is not mirrored). */
function toShapePoint(point: Vector2): Vector2 {
  return new Vector2(point.x - MAP_CENTER.x, -(point.y - MAP_CENTER.y));
}

/**
 * Groups rings into polygons with holes. d3 emits exteriors and holes with opposite winding,
 * so the winding of the largest ring identifies exteriors; each hole joins the smallest exterior around it.
 */
export function ringsToShapes(rings: Ring[]): Shape[] {
  if (rings.length === 0) return [];
  const areas = rings.map(signedArea);
  let largest = 0;
  for (let index = 1; index < rings.length; index++) {
    if (Math.abs(areas[index]) > Math.abs(areas[largest])) largest = index;
  }
  const exteriorSign = Math.sign(areas[largest]);
  const exteriors: { ring: Ring; area: number; shape: Shape }[] = [];
  const holes: Ring[] = [];
  rings.forEach((ring, index) => {
    if (Math.sign(areas[index]) === exteriorSign) {
      exteriors.push({ ring, area: Math.abs(areas[index]), shape: new Shape(ring.map(toShapePoint)) });
    } else {
      holes.push(ring);
    }
  });
  for (const hole of holes) {
    const candidates = exteriors.filter(exterior => containsPoint(exterior.ring, hole[0])).sort((a, b) => a.area - b.area);
    if (candidates.length === 0) continue;
    candidates[0].shape.holes.push(new Path(hole.map(toShapePoint)));
  }
  return exteriors.map(exterior => exterior.shape);
}

/** Projects longitude/latitude to the national SVG plane with the package's d3 Mercator parameters. */
export function projectLonLat(projection: { scale: number; translate: [number, number] }, lon: number, lat: number): Vector2 {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const x = projection.translate[0] + projection.scale * lambda;
  const y = projection.translate[1] - projection.scale * Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return new Vector2(x, y);
}

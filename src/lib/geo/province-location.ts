import type { GeometryPackage } from './types';

export const DEFAULT_DESTINATION_PROVINCE = '31';
type Point = [number, number];

function polygonRings(path: string): Point[][] {
  const rings: Point[][] = [];
  let ring: Point[] = [];
  for (const command of path.match(/[MLZ][^MLZ]*/g) ?? []) {
    if (command[0] === 'Z') {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
      continue;
    }
    if (command[0] === 'M' && ring.length >= 3) {
      rings.push(ring);
      ring = [];
    }
    const [x, y] = command.slice(1).split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    ring.push([x, y]);
  }
  if (ring.length >= 3) rings.push(ring);
  return rings;
}

function containsPoint(ring: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [ax, ay] = ring[current];
    const [bx, by] = ring[previous];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

/** Exact reference-polygon lookup, never the nearest province for an overseas user. */
export function provinceAtPosition(geometry: GeometryPackage | undefined, latitude: number, longitude: number): string | undefined {
  if (!geometry?.projection || geometry.projection.type !== 'mercator' || geometry.level !== 'province'
    || geometry.regions.length !== 38 || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) >= 90 || Math.abs(longitude) > 180) return undefined;
  const { scale, translate } = geometry.projection;
  if (!Number.isFinite(scale) || scale <= 0 || !translate.every(Number.isFinite)) return undefined;
  const x = translate[0] + scale * longitude * Math.PI / 180;
  const y = translate[1] - scale * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const matches: string[] = [];
  for (const region of geometry.regions) {
    const [left, top, right, bottom] = region.bbox;
    if (x < left || x > right || y < top || y > bottom) continue;
    let inside = false;
    for (const ring of polygonRings(region.path)) {
      if (containsPoint(ring, x, y)) inside = !inside;
    }
    if (inside) matches.push(region.sourceCode);
  }
  if (matches.length !== 1) return undefined;
  return matches[0];
}

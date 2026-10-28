// Shrinks static/illustrations/atlas-anatomy.svg: Douglas-Peucker simplification, 1-decimal
// coordinates, no per-province data attributes. Geometry and projection are unchanged.
import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../../static/illustrations/atlas-anatomy.svg', import.meta.url);
const TOLERANCE = 0.3; // viewBox units; ~0.36px at the largest hero size
const MIN_EXTENT = 0.7; // drop specks smaller than this in both directions

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function simplify(points) {
  if (points.length < 3) return points;
  let farthest = 0;
  let farthestIndex = 0;
  const last = points.length - 1;
  for (let index = 1; index < last; index += 1) {
    const distance = distanceToSegment(points[index], points[0], points[last]);
    if (distance > farthest) { farthest = distance; farthestIndex = index; }
  }
  if (farthest <= TOLERANCE) return [points[0], points[last]];
  const left = simplify(points.slice(0, farthestIndex + 1));
  const right = simplify(points.slice(farthestIndex));
  return left.slice(0, -1).concat(right);
}

function simplifyRing(ring) {
  // Split a ring at its extremes so DP keeps both ends stable.
  const half = Math.floor(ring.length / 2);
  const a = simplify(ring.slice(0, half + 1));
  const b = simplify(ring.slice(half).concat([ring[0]]));
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function simplifyPath(d) {
  const rings = d.split('Z').filter(Boolean).map(part =>
    part.replace(/^M/, '').split('L').map(pair => pair.split(',').map(Number)));
  const kept = [];
  for (const ring of rings) {
    const xs = ring.map(p => p[0]);
    const ys = ring.map(p => p[1]);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (extent < MIN_EXTENT || ring.length < 4) continue;
    const simple = simplifyRing(ring);
    if (simple.length < 3) continue;
    kept.push('M' + simple.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z');
  }
  return kept.join('');
}

const source = await readFile(file, 'utf8');
const output = source
  .replace(/ data-code="[^"]*"/g, '')
  .replace(/ d="([^"]+)"/g, (_, d) => ' d="' + simplifyPath(d) + '"');
await writeFile(file, output);
console.log('before', source.length, 'after', output.length);

import { BufferAttribute, BufferGeometry } from 'three';
import { HALO_HEIGHT, LIMB, LIMB_DROP, PLATEAU } from './layout';

const ANGULAR_SEGMENTS = 192;
const FLAT_RINGS = 8;
const ROLL_RINGS = 28;
const HALO_RINGS = 28;
/** Halo ring spans this range of the plateau→limb scale: it fades in under the limb and out into space. */
const HALO_START = 0.62;
const HALO_END = 1.45;

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

interface Ring {
  radiusX: number;
  radiusZ: number;
  height: number;
  /** 0 on the flat sea, rising to 1 at the rolled-over limb. */
  edge: number;
  glow: number;
}

/** Quads between consecutive rings, wound counter-clockwise when seen from above. */
function ringIndices(ringCount: number): number[] {
  const indices: number[] = [];
  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let segment = 0; segment < ANGULAR_SEGMENTS; segment++) {
      const next = (segment + 1) % ANGULAR_SEGMENTS;
      const innerA = ring * ANGULAR_SEGMENTS + segment;
      const innerB = ring * ANGULAR_SEGMENTS + next;
      const outerA = (ring + 1) * ANGULAR_SEGMENTS + segment;
      const outerB = (ring + 1) * ANGULAR_SEGMENTS + next;
      indices.push(innerA, innerB, outerA, innerB, outerB, outerA);
    }
  }
  return indices;
}

function buildRingGeometry(rings: Ring[], withNormals: boolean): BufferGeometry {
  const vertexCount = rings.length * ANGULAR_SEGMENTS;
  const positions = new Float32Array(vertexCount * 3);
  const edges = new Float32Array(vertexCount);
  const glows = new Float32Array(vertexCount);
  rings.forEach((ring, ringIndex) => {
    for (let segment = 0; segment < ANGULAR_SEGMENTS; segment++) {
      const angle = (segment / ANGULAR_SEGMENTS) * Math.PI * 2;
      const vertex = ringIndex * ANGULAR_SEGMENTS + segment;
      positions[vertex * 3] = Math.cos(angle) * ring.radiusX;
      positions[vertex * 3 + 1] = ring.height;
      positions[vertex * 3 + 2] = Math.sin(angle) * ring.radiusZ;
      edges[vertex] = ring.edge;
      glows[vertex] = ring.glow;
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('edge', new BufferAttribute(edges, 1));
  geometry.setAttribute('glow', new BufferAttribute(glows, 1));
  geometry.setIndex(ringIndices(rings.length));
  if (withNormals) geometry.computeVertexNormals();
  return geometry;
}

/**
 * The sea: a flat plateau under the map, then a rounded edge that rolls over a quarter ellipse (radius
 * LIMB_DROP) so the archipelago reads as a small world floating in space. Rings are evenly spaced along the arc.
 */
export function buildSeaGeometry(): BufferGeometry {
  const rings: Ring[] = [];
  for (let ring = 0; ring < FLAT_RINGS; ring++) {
    const scale = ring / FLAT_RINGS;
    rings.push({ radiusX: PLATEAU.radiusX * scale, radiusZ: PLATEAU.radiusZ * scale, height: 0, edge: 0, glow: 0 });
  }
  for (let ring = 0; ring <= ROLL_RINGS; ring++) {
    const arc = (ring / ROLL_RINGS) * (Math.PI / 2);
    const outward = Math.sin(arc);
    rings.push({
      radiusX: lerp(PLATEAU.radiusX, LIMB.radiusX, outward),
      radiusZ: lerp(PLATEAU.radiusZ, LIMB.radiusZ, outward),
      height: -LIMB_DROP * (1 - Math.cos(arc)),
      edge: ring / ROLL_RINGS,
      glow: 0
    });
  }
  return buildRingGeometry(rings, true);
}

/** A flat additive ring of light around the limb: the atmosphere seen edge-on. */
export function buildHaloGeometry(): BufferGeometry {
  const rings: Ring[] = [];
  for (let ring = 0; ring <= HALO_RINGS; ring++) {
    const scale = lerp(HALO_START, HALO_END, ring / HALO_RINGS);
    let glow = 0;
    if (scale <= 1) {
      const rise = (scale - HALO_START) / (1 - HALO_START);
      glow = rise * rise;
    } else {
      const fall = 1 - (scale - 1) / (HALO_END - 1);
      glow = fall * fall;
    }
    rings.push({
      radiusX: lerp(PLATEAU.radiusX, LIMB.radiusX, scale),
      radiusZ: lerp(PLATEAU.radiusZ, LIMB.radiusZ, scale),
      height: HALO_HEIGHT,
      edge: 1,
      glow
    });
  }
  return buildRingGeometry(rings, false);
}

import { BufferAttribute, BufferGeometry, Path, Shape, ShapeGeometry, Vector2, type Mesh } from 'three';
import { projectLonLat, type MercatorProjection } from './projection.ts';
import type { HistoryReferenceFeature } from './history-territories.ts';
import type { TerrainModel } from './terrain';
import type { TerrainSurface } from './terrain-mesh';

type Point = { x: number; y: number };
type HeightSampler = (x: number, y: number) => number;
const MAX_TRIANGLE_EDGE = 4;

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function appendTriangle(points: Point[], first: Point, second: Point, third: Point): void {
  const longestEdge = Math.max(Math.hypot(first.x - second.x, first.y - second.y), Math.hypot(second.x - third.x, second.y - third.y), Math.hypot(third.x - first.x, third.y - first.y));
  if (longestEdge <= MAX_TRIANGLE_EDGE) {
    // SVG's south-positive Y becomes world Z, so reverse the face for an upward normal.
    points.push(first, third, second);
    return;
  }
  const firstMid = midpoint(first, second);
  const secondMid = midpoint(second, third);
  const thirdMid = midpoint(third, first);
  appendTriangle(points, first, firstMid, thirdMid);
  appendTriangle(points, firstMid, second, secondMid);
  appendTriangle(points, thirdMid, secondMid, third);
  appendTriangle(points, firstMid, secondMid, thirdMid);
}

function projectedTriangles(feature: HistoryReferenceFeature, projection: MercatorProjection): Point[] {
  let polygons: number[][][][];
  if (feature.geometry.type === 'Polygon') polygons = [feature.geometry.coordinates];
  else polygons = feature.geometry.coordinates;
  const points: Point[] = [];
  for (const polygon of polygons) {
    const rings = polygon.map(ring => ring.map(([lon, lat]) => {
      const point = projectLonLat(projection, lon, lat);
      return new Vector2(point.x, point.y);
    }));
    const shape = new Shape(rings[0]);
    for (const ring of rings.slice(1)) shape.holes.push(new Path(ring));
    const triangulation = new ShapeGeometry(shape);
    const positions = triangulation.getAttribute('position');
    const index = triangulation.getIndex();
    if (!index) throw new Error('Context land triangulation has no index');
    for (let offset = 0; offset < index.count; offset += 3) {
      const triangle = [0, 1, 2].map(step => {
        const vertex = index.getX(offset + step);
        return { x: positions.getX(vertex), y: positions.getY(vertex) };
      });
      appendTriangle(points, triangle[0], triangle[1], triangle[2]);
    }
    triangulation.dispose();
  }
  return points;
}

/** Exact reference-land faces with extra interior samples, not a new province or political claim. */
export function historyContextGeometry(features: HistoryReferenceFeature[], projection: MercatorProjection, heightAt: HeightSampler, elevationAt: HeightSampler): BufferGeometry {
  const points = features.flatMap(feature => projectedTriangles(feature, projection));
  const positions = new Float32Array(points.length * 3);
  const elevations = new Float32Array(points.length);
  const lands = new Float32Array(points.length).fill(1);
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    positions[index * 3] = point.x - 500;
    positions[index * 3 + 1] = heightAt(point.x, point.y);
    positions[index * 3 + 2] = point.y - 250;
    elevations[index] = elevationAt(point.x, point.y);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('elevation', new BufferAttribute(elevations, 1));
  geometry.setAttribute('land', new BufferAttribute(lands, 1));
  return geometry;
}

interface HistoryContextOptions {
  model: TerrainModel;
  surface: TerrainSurface;
  features: HistoryReferenceFeature[];
  projection: MercatorProjection;
  mask: Float32Array;
  heightAt: HeightSampler;
}

/** Own only the optional neighboring land and restore the national terrain mask on removal. */
export class HistoryContextLayer {
  readonly mesh: Mesh;
  private readonly originalMask: Float32Array;
  private readonly model: TerrainModel;

  constructor({ model, surface, features, projection, mask, heightAt }: HistoryContextOptions) {
    this.model = model;
    this.originalMask = Float32Array.from(model.mask);
    for (let index = 0; index < model.mask.length; index++) model.mask[index] = Math.max(model.mask[index], mask[index]);
    const geometry = historyContextGeometry(features, projection, heightAt, (x, y) => model.elevationAt(x, y));
    this.mesh = surface.createContextMesh(geometry);
  }

  dispose(): void {
    this.model.mask.set(this.originalMask);
    this.mesh.geometry.dispose();
  }
}

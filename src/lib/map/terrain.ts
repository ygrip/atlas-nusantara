import { PLANE_HEIGHT, PLANE_WIDTH } from './weather';

/** Vertical exaggeration: Puncak Jaya (~4,400 m in the 1′ grid) rises ~15 map units on a 1,000-unit-wide map. */
export const METRES_TO_UNITS = 15 / 4400;
/** Land sits on a low clay plinth above the sea plane so coasts read clearly. */
export const LAND_BASE = 1.2;
export const SEA_FLOOR = -2.5;

/**
 * CPU copies of the relief and land mask, sampled in SVG plane coordinates (0..1000 × 0..500).
 * The terrain mesh, draped borders, wind particles and picking all use the same height function.
 */
export class TerrainModel {
  readonly elevation: Float32Array;
  readonly mask: Float32Array;

  constructor(
    elevation: Float32Array,
    readonly reliefWidth: number,
    readonly reliefHeight: number,
    mask: Float32Array,
    readonly maskWidth: number,
    readonly maskHeight: number
  ) {
    this.elevation = elevation;
    this.mask = mask;
  }

  private static bilinear(data: Float32Array, width: number, height: number, x: number, y: number): number {
    const fx = Math.min(width - 1.001, Math.max(0, (x / PLANE_WIDTH) * width - 0.5));
    const fy = Math.min(height - 1.001, Math.max(0, (y / PLANE_HEIGHT) * height - 0.5));
    const column = Math.floor(fx);
    const row = Math.floor(fy);
    const tx = fx - column;
    const ty = fy - row;
    const index = row * width + column;
    const top = data[index] * (1 - tx) + data[index + 1] * tx;
    const bottom = data[index + width] * (1 - tx) + data[index + width + 1] * tx;
    return top * (1 - ty) + bottom * ty;
  }

  /** Elevation in metres (negative below sea level). */
  elevationAt(x: number, y: number): number {
    return TerrainModel.bilinear(this.elevation, this.reliefWidth, this.reliefHeight, x, y);
  }

  /** 0 at sea, 1 on land, soft across the coastline. Land comes from the boundary package, not the relief grid. */
  landAt(x: number, y: number): number {
    const value = TerrainModel.bilinear(this.mask, this.maskWidth, this.maskHeight, x, y);
    return smoothstep(0.3, 0.7, value);
  }

  /** World height (map units) of the terrain surface. */
  heightAt(x: number, y: number): number {
    const land = this.landAt(x, y);
    const relief = LAND_BASE + Math.max(0, this.elevationAt(x, y)) * METRES_TO_UNITS;
    return land * relief + (1 - land) * SEA_FLOOR;
  }

  /** Height of whatever the eye sees: terrain on land, the sea surface offshore. */
  surfaceAt(x: number, y: number): number {
    return Math.max(0, this.heightAt(x, y));
  }
}

/** Extra slope applied only to shading so ridges read clearly even though the mesh is already exaggerated. */
const SHADING_EXAGGERATION = 2;
const CAVITY_BLUR_RADIUS = 10;
const CAVITY_RANGE_METRES = 400;

/**
 * Bakes shading data from the elevation grid as RGBA bytes: R/G = surface normal x/z (0.5 = flat),
 * B = valley occlusion (terrain lower than its surroundings), A = ridge highlight (higher than its surroundings).
 */
export function buildReliefDetail(elevation: Float32Array, width: number, height: number): Uint8Array {
  const heights = new Float32Array(elevation.length);
  for (let index = 0; index < heights.length; index++) heights[index] = Math.max(0, elevation[index]);
  const surroundings = Float32Array.from(heights);
  boxBlur(surroundings, width, height, CAVITY_BLUR_RADIUS);
  boxBlur(surroundings, width, height, CAVITY_BLUR_RADIUS);
  const cellWidth = PLANE_WIDTH / width;
  const cellHeight = PLANE_HEIGHT / height;
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const above = Math.max(0, row - 1);
    const below = Math.min(height - 1, row + 1);
    for (let column = 0; column < width; column++) {
      const left = Math.max(0, column - 1);
      const right = Math.min(width - 1, column + 1);
      const slopeX = ((heights[row * width + right] - heights[row * width + left]) * METRES_TO_UNITS) / (2 * cellWidth);
      const slopeZ = ((heights[below * width + column] - heights[above * width + column]) * METRES_TO_UNITS) / (2 * cellHeight);
      const normalX = -slopeX * SHADING_EXAGGERATION;
      const normalZ = -slopeZ * SHADING_EXAGGERATION;
      const length = Math.hypot(normalX, 1, normalZ);
      const index = row * width + column;
      const surface = heights[index] - surroundings[index];
      data[index * 4] = Math.round(((normalX / length) * 0.5 + 0.5) * 255);
      data[index * 4 + 1] = Math.round(((normalZ / length) * 0.5 + 0.5) * 255);
      data[index * 4 + 2] = Math.round(Math.min(1, Math.max(0, -surface / CAVITY_RANGE_METRES)) * 255);
      data[index * 4 + 3] = Math.round(Math.min(1, Math.max(0, surface / CAVITY_RANGE_METRES)) * 255);
    }
  }
  return data;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Decodes the relief PNG (elevation = (R·256 + G) / 3 − 11000). */
export async function loadRelief(url: string): Promise<{ elevation: Float32Array; width: number; height: number }> {
  const response = await fetch(url);
  if (!response.ok) throw Error('Relief unavailable');
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('Canvas unavailable');
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const elevation = new Float32Array(bitmap.width * bitmap.height);
  for (let index = 0; index < elevation.length; index++) {
    elevation[index] = (pixels[index * 4] * 256 + pixels[index * 4 + 1]) / 3 - 11000;
  }
  bitmap.close();
  return { elevation, width: canvas.width, height: canvas.height };
}

/** Rasterises region paths into a soft land mask (box-blurred so the coastline threshold is smooth). */
export function rasteriseMask(paths: string[], width: number, height: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('Canvas unavailable');
  context.scale(width / PLANE_WIDTH, height / PLANE_HEIGHT);
  context.fillStyle = '#fff';
  for (const path of paths) context.fill(new Path2D(path));
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = new Float32Array(width * height);
  for (let index = 0; index < mask.length; index++) mask[index] = pixels[index * 4] / 255;
  boxBlur(mask, width, height, 1);
  boxBlur(mask, width, height, 1);
  return mask;
}

/** In-place separable box blur (horizontal then vertical). */
export function boxBlur(data: Float32Array, width: number, height: number, radius: number): void {
  const copy = new Float32Array(data.length);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      let sum = 0;
      let count = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sample = column + offset;
        if (sample < 0 || sample >= width) continue;
        sum += data[row * width + sample];
        count++;
      }
      copy[row * width + column] = sum / count;
    }
  }
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      let sum = 0;
      let count = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const sample = row + offset;
        if (sample < 0 || sample >= height) continue;
        sum += copy[sample * width + column];
        count++;
      }
      data[row * width + column] = sum / count;
    }
  }
}

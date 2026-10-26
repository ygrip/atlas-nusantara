import { BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three';
import { MAP_CENTER, projectLonLat } from './geometry';
import type { PinSymbol, PointOverlay } from './overlay-contract';
import { pinFragment, pinVertex } from './shaders';
import type { TerrainModel } from './terrain';

/** Pins float just above whatever the eye sees: terrain on land, the sea surface offshore. */
export const PIN_LIFT = 4;
/** Sprite size in CSS pixels; the symbol fills the middle and the rest is room for the pulsing halo. */
const PIN_SPRITE_SIZE = 36;
const SYMBOLS: PinSymbol[] = ['circle', 'triangle', 'diamond'];

export function pinHeight(terrain: TerrainModel | undefined, x: number, y: number): number {
  if (!terrain) return PIN_LIFT;
  return terrain.surfaceAt(x, y) + PIN_LIFT;
}

/** One draw call for every pin; each pin keeps its own colour, symbol and halo phase. */
export function createPinPoints(
  overlay: PointOverlay,
  projection: { scale: number; translate: [number, number] },
  terrain: TerrainModel | undefined,
  time: { value: number },
  pixelRatio: number
): Points {
  const count = overlay.pins.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count).fill(PIN_SPRITE_SIZE);
  const colors = new Float32Array(count * 3);
  const symbols = new Float32Array(count);
  const phases = new Float32Array(count);
  overlay.pins.forEach((pin, index) => {
    const point = projectLonLat(projection, pin.lon, pin.lat);
    positions[index * 3] = point.x - MAP_CENTER.x;
    positions[index * 3 + 1] = pinHeight(terrain, point.x, point.y);
    positions[index * 3 + 2] = point.y - MAP_CENTER.y;
    const color = new Color(pin.color ?? overlay.color);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    symbols[index] = SYMBOLS.indexOf(pin.symbol ?? overlay.symbol);
    phases[index] = (index * 0.381966) % 1;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('size', new BufferAttribute(sizes, 1));
  geometry.setAttribute('pinColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('symbolIndex', new BufferAttribute(symbols, 1));
  geometry.setAttribute('phase', new BufferAttribute(phases, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: pinVertex,
    fragmentShader: pinFragment,
    uniforms: { time, pixelRatio: { value: pixelRatio } }
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 8;
  return points;
}

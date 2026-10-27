import { BufferAttribute, BufferGeometry, CanvasTexture, Color, LinearFilter, Points, SRGBColorSpace, ShaderMaterial } from 'three';
import { clayPinDocument, clayPinKey } from './clay-pin';
import { MAP_CENTER, projectLonLat } from './geometry';
import { mountainColor, type PinSymbol, type PointOverlay } from './overlay-contract';
import { pinFragment, pinVertex } from './shaders';
import type { TerrainModel } from './terrain';

/** Pins sit almost on whatever the eye sees (terrain on land, the sea surface offshore); the shader plants the marker's contact shadow on that point. */
export const PIN_LIFT = 0.3;
/** Sprite size in CSS pixels; the clay marker fills the middle and the rest is room for the pulsing halo. */
export const PIN_SPRITE_SIZE = 48;
/** Mirrors CONTACT_OFFSET in the pin vertex shader: how far below the sprite centre the marker touches the ground. */
export const PIN_CONTACT_OFFSET = 0.262;
/** The atlas holds one 128 px clay marker per distinct symbol and colour. */
const ATLAS_CELL_PIXELS = 128;
const ATLAS_COLUMNS = 8;
const ATLAS_MAX_CELLS = 128;

export function pinHeight(terrain: TerrainModel | undefined, x: number, y: number): number {
  if (!terrain) return PIN_LIFT;
  return terrain.surfaceAt(x, y) + PIN_LIFT;
}

interface AtlasEntry { symbol: PinSymbol; color: string }

function drawAtlasCell(context: CanvasRenderingContext2D, entry: AtlasEntry, cell: number): Promise<void> {
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clayPinDocument(entry.symbol, entry.color, ATLAS_CELL_PIXELS));
  return image.decode().then(() => {
    const column = cell % ATLAS_COLUMNS;
    const row = Math.floor(cell / ATLAS_COLUMNS);
    context.drawImage(image, column * ATLAS_CELL_PIXELS, row * ATLAS_CELL_PIXELS, ATLAS_CELL_PIXELS, ATLAS_CELL_PIXELS);
  });
}

/** Rasterises the shared SVG clay markers into one texture. Cells fill in as each SVG decodes. */
function createAtlas(entries: AtlasEntry[], onUpdate: () => void): { texture: CanvasTexture; rows: number } {
  const rows = Math.max(1, Math.ceil(entries.length / ATLAS_COLUMNS));
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * ATLAS_CELL_PIXELS;
  canvas.height = rows * ATLAS_CELL_PIXELS;
  const context = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  if (!context) return { texture, rows };
  entries.forEach((entry, cell) => {
    drawAtlasCell(context, entry, cell)
      .then(() => { texture.needsUpdate = true; onUpdate(); })
      .catch(error => console.warn('Clay pin could not be drawn', error));
  });
  return { texture, rows };
}

/** One draw call for every pin; each pin keeps its own clay marker and halo phase. */
export function createPinPoints(
  overlay: PointOverlay,
  projection: { scale: number; translate: [number, number] },
  terrain: TerrainModel | undefined,
  time: { value: number },
  pixelRatio: number,
  viewportHeight: { value: number },
  onTextureUpdate: () => void
): Points {
  const count = overlay.pins.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count).fill(PIN_SPRITE_SIZE);
  const colors = new Float32Array(count * 3);
  const cells = new Float32Array(count);
  const phases = new Float32Array(count);
  const cellByKey = new Map<string, number>();
  const entries: AtlasEntry[] = [];
  overlay.pins.forEach((pin, index) => {
    const point = projectLonLat(projection, pin.lon, pin.lat);
    positions[index * 3] = point.x - MAP_CENTER.x;
    positions[index * 3 + 1] = pinHeight(terrain, point.x, point.y);
    positions[index * 3 + 2] = point.y - MAP_CENTER.y;
    const colorHex = pin.color ?? mountainColor(pin) ?? overlay.color;
    const symbol = pin.symbol ?? overlay.symbol;
    const color = new Color(colorHex);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    const key = clayPinKey(symbol, colorHex);
    let cell = cellByKey.get(key);
    if (cell === undefined && entries.length < ATLAS_MAX_CELLS) {
      cell = entries.length;
      entries.push({ symbol, color: colorHex });
      cellByKey.set(key, cell);
    }
    cells[index] = cell ?? 0;
    phases[index] = (index * 0.381966) % 1;
  });
  const atlas = createAtlas(entries, onTextureUpdate);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('size', new BufferAttribute(sizes, 1));
  geometry.setAttribute('pinColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('cell', new BufferAttribute(cells, 1));
  geometry.setAttribute('phase', new BufferAttribute(phases, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: pinVertex,
    fragmentShader: pinFragment,
    uniforms: { time, viewportHeight, pixelRatio: { value: pixelRatio }, atlas: { value: atlas.texture }, atlasGrid: { value: [ATLAS_COLUMNS, atlas.rows] } }
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 8;
  return points;
}

export function disposePinPoints(points: Points): void {
  points.geometry.dispose();
  const material = points.material as ShaderMaterial;
  (material.uniforms.atlas.value as CanvasTexture).dispose();
  material.dispose();
}

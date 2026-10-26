import { BufferAttribute, BufferGeometry, Color, DataTexture, LinearFilter, Mesh, RGBAFormat, ShaderMaterial, type Texture, type Vector4 } from 'three';
import { MAP_CENTER } from './geometry';
import type { SharedUniforms } from './shared-uniforms';
import { buildReliefDetail, type TerrainModel } from './terrain';
import { terrainFragment, terrainVertex } from './terrain-shaders';
import type { MapTheme } from './themes';
import { PLANE_HEIGHT, PLANE_WIDTH } from './weather';

export interface RegionTextures {
  regionIds: Texture;
  detailIds: Texture;
  detailBounds: Vector4;
  palette: Texture;
}

const DESKTOP_COLUMNS = 1280;
const COMPACT_COLUMNS = 640;
/** Quads whose four corners sum to less land than this are open sea and are skipped. */
const MIN_QUAD_LAND = 0.02;

interface GridSamples {
  columns: number;
  rows: number;
  positions: Float32Array;
  elevations: Float32Array;
  lands: Float32Array;
}

function sampleGrid(model: TerrainModel, columns: number): GridSamples {
  const rows = columns / 2;
  const vertexCount = (columns + 1) * (rows + 1);
  const positions = new Float32Array(vertexCount * 3);
  const elevations = new Float32Array(vertexCount);
  const lands = new Float32Array(vertexCount);
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const index = row * (columns + 1) + column;
      const x = (column / columns) * PLANE_WIDTH;
      const y = (row / rows) * PLANE_HEIGHT;
      positions[index * 3] = x - MAP_CENTER.x;
      positions[index * 3 + 1] = model.heightAt(x, y);
      positions[index * 3 + 2] = y - MAP_CENTER.y;
      elevations[index] = model.elevationAt(x, y);
      lands[index] = model.landAt(x, y);
    }
  }
  return { columns, rows, positions, elevations, lands };
}

function quadHasLand(grid: GridSamples, row: number, column: number): boolean {
  const a = row * (grid.columns + 1) + column;
  const c = a + grid.columns + 1;
  return grid.lands[a] + grid.lands[a + 1] + grid.lands[c] + grid.lands[c + 1] >= MIN_QUAD_LAND;
}

/** Triangle indices for quads that touch land, counted first so a typed array is allocated once. */
function landIndices(grid: GridSamples): Uint32Array {
  let quads = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      if (quadHasLand(grid, row, column)) quads++;
    }
  }
  const indices = new Uint32Array(quads * 6);
  let cursor = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      if (!quadHasLand(grid, row, column)) continue;
      const a = row * (grid.columns + 1) + column;
      const b = a + 1;
      const c = a + grid.columns + 1;
      const d = c + 1;
      indices.set([a, c, b, b, c, d], cursor);
      cursor += 6;
    }
  }
  return indices;
}

function createReliefTexture(model: TerrainModel): DataTexture {
  const data = buildReliefDetail(model.elevation, model.reliefWidth, model.reliefHeight);
  const texture = new DataTexture(data, model.reliefWidth, model.reliefHeight, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The land: a height-field mesh over the relief whose shading comes from a baked normal map. */
export class TerrainSurface {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly reliefTexture: DataTexture;

  constructor(model: TerrainModel, shared: SharedUniforms, theme: MapTheme, textures: RegionTextures, compact: boolean) {
    let columns = DESKTOP_COLUMNS;
    if (compact) columns = COMPACT_COLUMNS;
    const grid = sampleGrid(model, columns);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(grid.positions, 3));
    geometry.setAttribute('elevation', new BufferAttribute(grid.elevations, 1));
    geometry.setAttribute('land', new BufferAttribute(grid.lands, 1));
    geometry.setIndex(new BufferAttribute(landIndices(grid), 1));
    this.reliefTexture = createReliefTexture(model);
    this.material = new ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        ...shared,
        regionIds: { value: textures.regionIds },
        detailIds: { value: textures.detailIds },
        detailBounds: { value: textures.detailBounds },
        palette: { value: textures.palette },
        reliefDetail: { value: this.reliefTexture },
        skyLight: { value: new Color(theme.skyLight) },
        groundLight: { value: new Color(theme.groundLight) },
        sandColor: { value: new Color(theme.sand) },
        contourStrength: { value: 1 }
      }
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.renderOrder = 1;
  }

  setTheme(theme: MapTheme): void {
    const uniforms = this.material.uniforms;
    uniforms.skyLight.value.set(theme.skyLight);
    uniforms.groundLight.value.set(theme.groundLight);
    uniforms.sandColor.value.set(theme.sand);
  }

  /** 0 hides the elevation contour lines; 1 shows them (they also fade with distance by themselves). */
  setContourStrength(strength: number): void {
    this.material.uniforms.contourStrength.value = strength;
  }

  dispose(): void {
    this.reliefTexture.dispose();
  }
}

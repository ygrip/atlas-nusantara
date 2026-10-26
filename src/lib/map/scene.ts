import {
  BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, LinearFilter, LineBasicMaterial,
  LineSegments, Mesh, NearestFilter, NormalBlending, PerspectiveCamera, PlaneGeometry, RedFormat, RGBAFormat, Raycaster,
  Points, Scene, ShaderMaterial, Spherical, Vector2, Vector3, WebGLRenderer
} from 'three';
import { visualRandom } from './random';
import { RegionIndex } from './region-index';
import { CAMERA_LIMITS, fitMapDistance } from './camera';
import { WindParticles, RainStreaks } from './particles';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { GeometryPackage } from '$lib/geo/types';
import type { MapPin, PointOverlay } from './overlays';
import { projectLonLat } from './geometry';
import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
import { MAP_CENTER, parseRings } from './geometry';
import { TerrainModel } from './terrain';
import { FIELD_HEIGHT, FIELD_WIDTH, packField, PLANE_HEIGHT, PLANE_WIDTH, sampleChannel, type WeatherField } from './weather';
import { cloudFragment, cloudVertex, cloudVeilFragment, cloudVeilVertex, seaFragment, seaVertex, terrainFragment, terrainVertex } from './shaders';

export type ThemeName = 'light' | 'dark';
export interface MapLayers { wind: boolean; weather: boolean; sea: boolean }

export interface SceneCallbacks {
  onselect: (code: string) => void;
  onhover: (code: string | undefined, clientX: number, clientY: number) => void;
  onzoom: (level: number) => void;
  onfeature?: (pin: MapPin | undefined, clientX: number, clientY: number) => void;
}

interface RegionEntry { id: number; code: string; name: string; bbox: [number, number, number, number]; rings: Vector2[][]; level: 'province' | 'city' }

const ID_WIDTH = 2048;
const ID_HEIGHT = 1024;
const SELECTED_COLOR = new Color('#e07a4f');
const CITY_ID_OFFSET = 100;

const THEMES = {
  light: {
    sky: '#f3ede3', fog: '#efe7da', shallow: '#7fd6cf', mid: '#3c9ec0', deep: '#1c4f7d', foam: '#f7fbfb', skyReflection: '#d8ecf3',
    skyLight: '#fff7ea', groundLight: '#b9a58f', coast: '#e8d3b0', border: '#fffaf0', cityBorder: '#5b4a3d',
    cloudLit: '#ffffff', cloudShade: '#b9c3cf', storm: '#6c7280'
  },
  dark: {
    sky: '#1d1c22', fog: '#1d1c22', shallow: '#2f8f8c', mid: '#1d5f7e', deep: '#0d2b45', foam: '#d9e6ea', skyReflection: '#28323f',
    skyLight: '#d9d3e6', groundLight: '#3d3640', coast: '#8a7660', border: '#f1e9df', cityBorder: '#1b1714',
    cloudLit: '#d9dde4', cloudShade: '#6d7584', storm: '#3e4350'
  }
} as const;

function emptyField(): WeatherField {
  const size = FIELD_WIDTH * FIELD_HEIGHT;
  return { width: FIELD_WIDTH, height: FIELD_HEIGHT, u: new Float32Array(size), v: new Float32Array(size), cloud: new Float32Array(size), rain: new Float32Array(size), thunder: [], meanU: 0, meanV: 0 };
}

function fieldTexture(field: WeatherField): DataTexture {
  const texture = new DataTexture(packField(field), field.width, field.height, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Converts plane coordinates (SVG units) to world coordinates on the ground. */
function world(x: number, y: number, height: number): Vector3 {
  return new Vector3(x - MAP_CENTER.x, height, y - MAP_CENTER.y);
}

/**
 * The 2.5D atlas: relief terrain coloured by region, a wind-driven sea, drifting clouds,
 * rain and wind streaks derived from a dated forecast snapshot. Renders only while visible.
 */
export class AtlasScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA_LIMITS.fov, 1, 1, CAMERA_LIMITS.far);
  private readonly controls: MapControls;
  private readonly raycaster = new Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private frame = 0;
  private visible = true;
  private lastTime = performance.now();
  private elapsed = 0;
  private dirty = true;
  private disposed = false;
  private rendering = false;
  private homeDistance = 1;
  private flight: { from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3; start: number; duration: number } | undefined;

  private terrain: TerrainModel | undefined;
  private terrainMesh: Mesh | undefined;
  private terrainMaterial: ShaderMaterial | undefined;
  private seaMaterial: ShaderMaterial | undefined;
  private cloudMaterials: ShaderMaterial[] = [];
  private cloudVeil: ShaderMaterial | undefined;
  private borderLines: LineSegments | undefined;
  private cityLines: LineSegments | undefined;
  private observationPoints: Points | undefined;
  private pointOverlay: PointOverlay | undefined;
  private pointProjection: GeometryPackage['projection'];
  private readonly baseIndex = new RegionIndex(ID_WIDTH, ID_HEIGHT);
  private readonly detailIndex = new RegionIndex(2048, 2048);
  private paletteData = new Uint8Array(256 * 4);
  private paletteTexture: DataTexture;
  private landMaskTexture: DataTexture | undefined;
  private bathymetryTexture: DataTexture | undefined;
  private weatherA: DataTexture;
  private weatherB: DataTexture;
  private fieldA: WeatherField = emptyField();
  private fieldB: WeatherField = emptyField();
  private weatherMix = 0;
  private provinces: RegionEntry[] = [];
  private cities: RegionEntry[] = [];
  private byId = new Map<number, RegionEntry>();
  private openProvince: string | undefined;
  private selectedCode: string | undefined;
  private hoverId = 0;
  private theme: ThemeName = 'light';
  private layers: MapLayers = { wind: true, weather: true, sea: true };
  private readonly windParticles: WindParticles;
  private readonly rain: RainStreaks;
  private cloudDrift = new Vector2();
  private readonly random = visualRandom(6117);
  private flash = 0;
  private flashPosition = new Vector3();
  private pointerDown: { x: number; y: number } | undefined;
  private activePointers = new Set<number>();
  private pendingHover: { x: number; y: number } | undefined;

  constructor(private readonly container: HTMLElement, private readonly callbacks: SceneCallbacks, private readonly reducedMotion: boolean) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    let pixelRatioLimit = 2;
    if (window.innerWidth < 700) pixelRatioLimit = 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
    this.renderer.domElement.className = 'atlas-canvas';
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = CAMERA_LIMITS.minDistance;
    this.controls.maxDistance = CAMERA_LIMITS.maxDistance;
    this.controls.maxPolarAngle = 1.2;
    this.controls.addEventListener('change', () => { this.invalidate(); this.emitZoom(); });

    this.paletteTexture = new DataTexture(this.paletteData, 256, 1, RGBAFormat);
    this.paletteTexture.magFilter = NearestFilter;
    this.paletteTexture.minFilter = NearestFilter;
    this.weatherA = fieldTexture(this.fieldA);
    this.weatherB = fieldTexture(this.fieldB);

    this.windParticles = new WindParticles(window.innerWidth < 700);
    this.rain = new RainStreaks(window.innerWidth < 700);
    this.scene.add(this.windParticles.lines, this.rain.lines);

    this.applyTheme('light');
    this.bindPointer();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) this.start();
    });
    this.visibilityObserver.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.home(false);
    this.start();
  }

  /** National provinces, relief and land mask. Call once; later province packages only add detail. */
  setNational(national: GeometryPackage, relief: { elevation: Float32Array; width: number; height: number }, mask: Float32Array, maskSize: [number, number]): void {
    this.terrain = new TerrainModel(relief.elevation, relief.width, relief.height, mask, maskSize[0], maskSize[1]);
    this.provinces = national.regions.map((region, index) => ({
      id: index + 1, code: region.sourceCode, name: region.name, bbox: region.bbox as [number, number, number, number],
      rings: parseRings(region.path), level: 'province'
    }));
    this.rebuildIndex();
    this.rasteriseIds();
    this.buildSea(relief, mask, maskSize);
    this.buildTerrain();
    this.buildClouds();
    this.buildCloudVeil();
    this.borderLines = this.buildBorders(this.provinces, THEMES[this.theme].border, 0.85, 0.35);
    this.scene.add(this.borderLines);
    this.windParticles.attach(this.terrain);
    this.rain.attach(this.terrain);
    this.updatePalette();
    this.updateFogRange();
    this.dirty = true;
  }

  /** Shows the cities of one province (from its package, same projection) or returns to provinces. */
  setProvince(code: string | undefined, detail: GeometryPackage | undefined, animate = true): void {
    this.openProvince = code;
    this.cities = [];
    if (code && detail) {
      this.cities = detail.regions.map((region, index) => ({
        id: CITY_ID_OFFSET + index + 1, code: region.sourceCode, name: region.name, bbox: region.bbox as [number, number, number, number],
        rings: parseRings(region.path), level: 'city'
      }));
    }
    this.rebuildIndex();
    this.rasteriseIds();
    if (this.cityLines) { this.scene.remove(this.cityLines); this.cityLines.geometry.dispose(); this.cityLines = undefined; }
    if (this.cities.length > 0) {
      this.cityLines = this.buildBorders(this.cities, THEMES[this.theme].cityBorder, 0.55, 0.3);
      this.scene.add(this.cityLines);
    }
    this.updatePalette();
    const province = this.provinces.find(item => item.code === code);
    if (province) this.flyToBox(province.bbox, animate);
    if (!code) this.home(animate);
    this.dirty = true;
  }

  /** Every overlay pin uses actual coordinates, never a name-to-region join. */
  setOverlay(overlay: PointOverlay | undefined, projection: NonNullable<GeometryPackage['projection']>): void {
    this.pointOverlay = overlay;
    this.pointProjection = projection;
    if (this.observationPoints) {
      this.scene.remove(this.observationPoints);
      this.observationPoints.geometry.dispose();
      (this.observationPoints.material as ShaderMaterial).dispose();
      this.observationPoints = undefined;
    }
    if (!overlay || overlay.pins.length === 0) { this.invalidate(); return; }
    const positions: number[] = [];
    const sizes: number[] = [];
    for (const pin of overlay.pins) {
      const point = projectLonLat(projection, pin.lon, pin.lat);
      const height = (this.terrain?.surfaceAt(point.x, point.y) ?? 0) + 4;
      positions.push(point.x - MAP_CENTER.x, height, point.y - MAP_CENTER.y);
      sizes.push(20);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('size', new BufferAttribute(new Float32Array(sizes), 1));
    const material = new ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { pinColor: { value: new Color(overlay.color) }, symbol: { value: ['circle', 'triangle', 'diamond'].indexOf(overlay.symbol) } },
      vertexShader: `attribute float size; void main() { gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 pinColor; uniform int symbol;
        void main() {
          vec2 p = gl_PointCoord - vec2(0.5);
          float radius = length(p);
          if (symbol == 1) radius = max(abs(p.x) * 1.73 + p.y, -p.y * 2.0) * 0.5;
          if (symbol == 2) radius = (abs(p.x) + abs(p.y)) * 0.75;
          if (radius > 0.48) discard;
          float ring = smoothstep(0.31, 0.36, radius);
          gl_FragColor = vec4(mix(pinColor, vec3(1.0, 0.94, 0.8), ring), 0.95);
          #include <colorspace_fragment>
        }`
    });
    this.observationPoints = new Points(geometry, material);
    this.observationPoints.renderOrder = 8;
    this.scene.add(this.observationPoints);
    this.invalidate();
  }

  setSelected(code: string | undefined): void {
    const previous = this.selectedCode;
    this.selectedCode = code;
    this.updatePalette();
    const city = this.cities.find(item => item.code === code);
    if (city) this.flyToBox(city.bbox, !this.reducedMotion, 1.6);
    else if (previous && !code) {
      const province = this.provinces.find(item => item.code === this.openProvince);
      if (province) this.flyToBox(province.bbox, !this.reducedMotion);
    }
    this.dirty = true;
  }

  setWeather(current: WeatherField, next: WeatherField | undefined, mix: number): void {
    if (current !== this.fieldA) { this.fieldA = current; this.replaceWeatherTexture('A', current); }
    const following = next ?? current;
    if (following !== this.fieldB) { this.fieldB = following; this.replaceWeatherTexture('B', following); }
    this.weatherMix = mix;
    this.windParticles.setFields(this.fieldA, this.fieldB, mix);
    this.rain.setFields(this.fieldA, this.fieldB, mix);
    for (const material of this.allWeatherMaterials()) material.uniforms.weatherMix.value = mix;
    this.invalidate();
  }

  setLayers(layers: MapLayers): void {
    this.layers = layers;
    this.windParticles.lines.visible = layers.wind;
    this.rain.lines.visible = layers.weather;
    for (const material of this.cloudMaterials) material.visible = layers.weather;
    this.invalidate();
  }

  applyTheme(theme: ThemeName): void {
    this.theme = theme;
    const colors = THEMES[theme];
    this.scene.background = new Color(colors.sky);
    this.renderer.setClearColor(colors.sky);
    if (this.seaMaterial) {
      const uniforms = this.seaMaterial.uniforms;
      uniforms.shallowColor.value.set(colors.shallow);
      uniforms.midColor.value.set(colors.mid);
      uniforms.deepColor.value.set(colors.deep);
      uniforms.skyColor.value.set(colors.skyReflection);
      uniforms.foamColor.value.set(colors.foam);
    }
    for (const material of this.allShaderMaterials()) material.uniforms.fogColor.value.set(colors.fog);
    if (this.terrainMaterial) {
      this.terrainMaterial.uniforms.skyLight.value.set(colors.skyLight);
      this.terrainMaterial.uniforms.groundLight.value.set(colors.groundLight);
      this.terrainMaterial.uniforms.coastColor.value.set(colors.coast);
    }
    this.cloudVeil?.uniforms.color.value.set(colors.cloudLit);
    for (const material of this.cloudMaterials) {
      material.uniforms.litColor.value.set(colors.cloudLit);
      material.uniforms.shadeColor.value.set(colors.cloudShade);
      material.uniforms.stormColor.value.set(colors.storm);
    }
    if (this.borderLines) (this.borderLines.material as LineBasicMaterial).color.set(colors.border);
    if (this.cityLines) (this.cityLines.material as LineBasicMaterial).color.set(colors.cityBorder);
    this.windParticles.setTheme(theme);
    this.updatePalette();
    this.dirty = true;
  }

  zoomBy(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, offset.length() / factor));
    offset.setLength(distance);
    this.flyTo(this.controls.target.clone().add(offset), this.controls.target.clone(), 260);
  }

  /** Toggles between a top-down plan view and the default 2.5D tilt. */
  toggleTilt(): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    if (spherical.phi > 0.2) spherical.phi = 0.01;
    else spherical.phi = 0.78;
    this.flyTo(this.controls.target.clone().add(new Vector3().setFromSpherical(spherical)), this.controls.target.clone(), 520);
  }

  resetNorth(): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta = 0;
    this.flyTo(this.controls.target.clone().add(new Vector3().setFromSpherical(spherical)), this.controls.target.clone(), 520);
  }

  home(animate = true): void {
    this.homeDistance = this.fitDistance([20, 30, 980, 470], 1);
    this.flyToBox([20, 30, 980, 470], animate, 1);
    this.updateFogRange();
    this.emitZoom();
  }

  private updateFogRange(): void {
    // A fitted phone view is farther away. Do not turn it into fog simply because the viewport is narrow.
    for (const material of this.allShaderMaterials()) {
      material.uniforms.fogNear.value = Math.max(1400, this.homeDistance * 1.4);
      material.uniforms.fogFar.value = Math.max(3600, this.homeDistance * 3.2);
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls.dispose();
    this.scene.traverse(object => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as ShaderMaterial | ShaderMaterial[] | undefined;
      if (Array.isArray(material)) material.forEach(item => item.dispose());
      else material?.dispose();
    });
    for (const texture of [this.paletteTexture, this.weatherA, this.weatherB, this.landMaskTexture, this.bathymetryTexture]) texture?.dispose();
    this.baseIndex.dispose();
    this.detailIndex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.renderer.forceContextLoss();
  }

  // --- building -----------------------------------------------------------------------------

  private rebuildIndex(): void {
    this.byId = new Map();
    for (const region of [...this.provinces, ...this.cities]) this.byId.set(region.id, region);
  }

  private rasteriseIds(): void {
    this.baseIndex.set(this.provinces);
    if (this.cities.length === 0) { this.detailIndex.set([]); return; }
    const left = Math.min(...this.cities.map(region => region.bbox[0]));
    const top = Math.min(...this.cities.map(region => region.bbox[1]));
    const right = Math.max(...this.cities.map(region => region.bbox[2]));
    const bottom = Math.max(...this.cities.map(region => region.bbox[3]));
    const pad = Math.max(right - left, bottom - top) * 0.01 + 0.001;
    this.detailIndex.set(this.cities, [left - pad, top - pad, right - left + pad * 2, bottom - top + pad * 2]);
  }

  private buildSea(relief: { elevation: Float32Array; width: number; height: number }, mask: Float32Array, maskSize: [number, number]): void {
    const depth = new Uint8Array(relief.width * relief.height);
    for (let index = 0; index < depth.length; index++) {
      const metres = Math.max(0, -relief.elevation[index]);
      depth[index] = Math.round(Math.sqrt(Math.min(1, metres / 9000)) * 255);
    }
    this.bathymetryTexture = new DataTexture(depth, relief.width, relief.height, RedFormat);
    this.bathymetryTexture.magFilter = LinearFilter;
    this.bathymetryTexture.minFilter = LinearFilter;
    this.bathymetryTexture.needsUpdate = true;
    const maskBytes = new Uint8Array(mask.length);
    for (let index = 0; index < mask.length; index++) maskBytes[index] = Math.round(mask[index] * 255);
    this.landMaskTexture = new DataTexture(maskBytes, maskSize[0], maskSize[1], RedFormat);
    this.landMaskTexture.magFilter = LinearFilter;
    this.landMaskTexture.minFilter = LinearFilter;
    this.landMaskTexture.needsUpdate = true;

    const colors = THEMES[this.theme];
    this.seaMaterial = new ShaderMaterial({
      vertexShader: seaVertex,
      fragmentShader: seaFragment,
      uniforms: {
        time: { value: 0 }, landMask: { value: this.landMaskTexture }, bathymetry: { value: this.bathymetryTexture },
        weatherA: { value: this.weatherA }, weatherB: { value: this.weatherB }, weatherMix: { value: 0 },
        sunDirection: { value: new Vector3(-0.45, 0.8, -0.35) },
        shallowColor: { value: new Color(colors.shallow) }, midColor: { value: new Color(colors.mid) }, deepColor: { value: new Color(colors.deep) },
        skyColor: { value: new Color(colors.skyReflection) }, foamColor: { value: new Color(colors.foam) }, flash: { value: 0 },
        fogColor: { value: new Color(colors.fog) }, fogNear: { value: 1400 }, fogFar: { value: 3600 }
      }
    });
    const geometry = new PlaneGeometry(4000, 2600, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const sea = new Mesh(geometry, this.seaMaterial);
    sea.renderOrder = 0;
    this.scene.add(sea);
  }

  /** A height-field mesh over the land, skipping quads that are entirely open sea. */
  private buildTerrain(): void {
    const terrain = this.terrain;
    if (!terrain) return;
    let columns = 1024;
    if (window.innerWidth < 700) columns = 640;
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
        positions[index * 3 + 1] = terrain.heightAt(x, y);
        positions[index * 3 + 2] = y - MAP_CENTER.y;
        elevations[index] = terrain.elevationAt(x, y);
        lands[index] = terrain.landAt(x, y);
      }
    }
    const indices: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        if (lands[a] + lands[b] + lands[c] + lands[d] < 0.02) continue;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('elevation', new BufferAttribute(elevations, 1));
    geometry.setAttribute('land', new BufferAttribute(lands, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const colors = THEMES[this.theme];
    this.terrainMaterial = new ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        regionIds: { value: this.baseIndex.texture }, detailIds: { value: this.detailIndex.texture }, detailBounds: { value: this.detailIndex.bounds }, palette: { value: this.paletteTexture },
        sunDirection: { value: new Vector3(-0.45, 0.8, -0.35) }, skyLight: { value: new Color(colors.skyLight) },
        groundLight: { value: new Color(colors.groundLight) }, coastColor: { value: new Color(colors.coast) },
        contourStrength: { value: 1 }, flash: { value: 0 },
        fogColor: { value: new Color(colors.fog) }, fogNear: { value: 1400 }, fogFar: { value: 3600 }
      }
    });
    this.terrainMesh = new Mesh(geometry, this.terrainMaterial);
    this.terrainMesh.renderOrder = 1;
    this.scene.add(this.terrainMesh);
  }

  private buildClouds(): void {
    const colors = THEMES[this.theme];
    // Keep coastlines and relief legible through a translucent forecast overlay.
    const layers = [{ height: 24, scale: 0.016, opacity: 0.34, seed: 0 }, { height: 31, scale: 0.009, opacity: 0.22, seed: 41.7 }];
    for (const layer of layers) {
      const material = new ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: NormalBlending,
        uniforms: {
          time: { value: 0 }, drift: { value: new Vector2() }, scale: { value: layer.scale }, opacity: { value: layer.opacity }, seed: { value: layer.seed },
          weatherA: { value: this.weatherA }, weatherB: { value: this.weatherB }, weatherMix: { value: 0 },
          sunDirection: { value: new Vector3(-0.45, 0.8, -0.35) }, litColor: { value: new Color(colors.cloudLit) },
          shadeColor: { value: new Color(colors.cloudShade) }, stormColor: { value: new Color(colors.storm) },
          flashPosition: { value: new Vector3() }, flash: { value: 0 },
          fogColor: { value: new Color(colors.fog) }, fogNear: { value: 1400 }, fogFar: { value: 3600 }
        }
      });
      const geometry = new PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT, 1, 1);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new Mesh(geometry, material);
      mesh.position.y = layer.height;
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.cloudMaterials.push(material);
    }
  }

  private buildCloudVeil(): void {
    this.cloudVeil = new ShaderMaterial({
      vertexShader: cloudVeilVertex, fragmentShader: cloudVeilFragment,
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { time: { value: 0 }, density: { value: 0 }, color: { value: new Color(THEMES[this.theme].cloudLit) } }
    });
    const veil = new Mesh(new PlaneGeometry(2, 2), this.cloudVeil);
    veil.frustumCulled = false;
    veil.renderOrder = 7;
    this.scene.add(veil);
  }

  /** Region outlines draped on the relief; long edges are subdivided so they follow the ground. */
  private buildBorders(regions: RegionEntry[], color: string, opacity: number, lift: number): LineSegments {
    const terrain = this.terrain;
    const points: number[] = [];
    for (const region of regions) {
      for (const ring of region.rings) {
        for (let index = 0; index < ring.length; index++) {
          const a = ring[index];
          const b = ring[(index + 1) % ring.length];
          const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 1.2));
          for (let step = 0; step < steps; step++) {
            const start = a.clone().lerp(b, step / steps);
            const end = a.clone().lerp(b, (step + 1) / steps);
            let startHeight = lift;
            let endHeight = lift;
            if (terrain) {
              startHeight += terrain.surfaceAt(start.x, start.y);
              endHeight += terrain.surfaceAt(end.x, end.y);
            }
            points.push(start.x - MAP_CENTER.x, startHeight, start.y - MAP_CENTER.y, end.x - MAP_CENTER.x, endHeight, end.y - MAP_CENTER.y);
          }
        }
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
    const lines = new LineSegments(geometry, new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    lines.renderOrder = 2;
    return lines;
  }

  /** Palette per region id: island-group clay tones, dimmed outside the open province, terracotta for the selection. */
  private updatePalette(): void {
    const data = this.paletteData;
    data.fill(0);
    const variant = (color: Color, index: number) => {
      const offsets = [0, 0.05, -0.05, 0.09, -0.08];
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      return new Color().setHSL(hsl.h, hsl.s, Math.min(0.92, Math.max(0.25, hsl.l + offsets[index % offsets.length])));
    };
    for (const region of [...this.provinces, ...this.cities]) {
      const tones = ISLAND_GROUP_COLORS[islandGroupOf(region.code)][this.theme];
      let color = variant(new Color(tones[0]), region.id);
      if (this.openProvince && region.level === 'province' && region.code !== this.openProvince) {
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        color = new Color().setHSL(hsl.h, hsl.s * 0.35, hsl.l * 0.92);
      }
      if (region.code === this.selectedCode || (region.level === 'province' && region.code === this.openProvince && this.cities.length === 0)) color = SELECTED_COLOR.clone();
      if (region.id === this.hoverId) color.offsetHSL(0, 0.04, 0.07);
      data[region.id * 4] = Math.round(color.r * 255);
      data[region.id * 4 + 1] = Math.round(color.g * 255);
      data[region.id * 4 + 2] = Math.round(color.b * 255);
      data[region.id * 4 + 3] = 255;
    }
    this.paletteTexture.needsUpdate = true;
    this.invalidate();
  }

  private replaceWeatherTexture(slot: 'A' | 'B', field: WeatherField): void {
    const texture = fieldTexture(field);
    if (slot === 'A') { this.weatherA.dispose(); this.weatherA = texture; }
    else { this.weatherB.dispose(); this.weatherB = texture; }
    for (const material of this.allWeatherMaterials()) {
      material.uniforms.weatherA.value = this.weatherA;
      material.uniforms.weatherB.value = this.weatherB;
    }
  }

  private allWeatherMaterials(): ShaderMaterial[] {
    const materials = [...this.cloudMaterials];
    if (this.seaMaterial) materials.push(this.seaMaterial);
    return materials;
  }

  private allShaderMaterials(): ShaderMaterial[] {
    const materials = this.allWeatherMaterials();
    if (this.terrainMaterial) materials.push(this.terrainMaterial);
    return materials;
  }

  // --- camera -------------------------------------------------------------------------------

  private fitDistance(box: [number, number, number, number], padding: number): number {
    return fitMapDistance(box, this.camera.aspect, padding);
  }

  private flyToBox(box: [number, number, number, number], animate: boolean, padding = 1.15): void {
    const center = world((box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 0);
    if (this.terrain) center.y = Math.max(0, this.terrain.surfaceAt((box[0] + box[2]) / 2, (box[1] + box[3]) / 2) * 0.5);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new Spherical().setFromVector3(offset);
    if (!Number.isFinite(spherical.radius) || spherical.radius < 1) spherical.set(1, 0.74, 0);
    if (spherical.phi < 0.05) spherical.phi = 0.01;
    else spherical.phi = Math.min(0.9, Math.max(0.5, spherical.phi));
    spherical.radius = this.fitDistance(box, padding);
    const position = center.clone().add(new Vector3().setFromSpherical(spherical));
    if (!animate || this.reducedMotion) {
      this.flight = undefined;
      this.camera.position.copy(position);
      this.controls.target.copy(center);
      this.controls.update();
      this.invalidate();
      this.emitZoom();
      return;
    }
    this.flyTo(position, center, 900);
  }

  private flyTo(position: Vector3, target: Vector3, duration: number): void {
    if (this.reducedMotion) duration = 0;
    this.flight = { from: this.camera.position.clone(), to: position, fromTarget: this.controls.target.clone(), toTarget: target, start: performance.now(), duration };
    this.start();
  }

  private stepFlight(now: number): void {
    if (!this.flight) return;
    const { from, to, fromTarget, toTarget, start, duration } = this.flight;
    let progress = 1;
    if (duration > 0) progress = Math.min(1, (now - start) / duration);
    let eased = 1 - (-2 * progress + 2) ** 3 / 2;
    if (progress < 0.5) eased = 4 * progress ** 3;
    this.camera.position.lerpVectors(from, to, eased);
    this.controls.target.lerpVectors(fromTarget, toTarget, eased);
    if (progress >= 1) this.flight = undefined;
    this.dirty = true;
    this.emitZoom();
  }

  private emitZoom(): void {
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.callbacks.onzoom(this.homeDistance / Math.max(distance, 1));
  }

  // --- interaction --------------------------------------------------------------------------

  private bindPointer(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', event => {
      this.activePointers.add(event.pointerId);
      this.pointerDown = undefined;
      if (this.activePointers.size === 1 && event.button === 0) this.pointerDown = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointercancel', event => { this.activePointers.delete(event.pointerId); this.pointerDown = undefined; });
    canvas.addEventListener('keydown', event => {
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomBy(1.3); return; }
      if (event.key === '-') { event.preventDefault(); this.zoomBy(1 / 1.3); return; }
      if (event.key === 'Home') { event.preventDefault(); this.home(); return; }
      const step = this.camera.position.distanceTo(this.controls.target) * 0.035;
      const movement = new Vector3();
      if (event.key === 'ArrowLeft') movement.x = -step;
      else if (event.key === 'ArrowRight') movement.x = step;
      else if (event.key === 'ArrowUp') movement.z = -step;
      else if (event.key === 'ArrowDown') movement.z = step;
      else return;
      event.preventDefault();
      this.flyTo(this.camera.position.clone().add(movement), this.controls.target.clone().add(movement), 180);
    });
    canvas.addEventListener('pointerup', event => {
      if (this.activePointers.size > 1) this.pointerDown = undefined;
      this.activePointers.delete(event.pointerId);
      const start = this.pointerDown;
      this.pointerDown = undefined;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      const pin = this.pickPin(event.clientX, event.clientY);
      if (pin) { this.callbacks.onfeature?.(pin, event.clientX, event.clientY); return; }
      const region = this.pick(event.clientX, event.clientY);
      if (region) this.callbacks.onselect(region.code);
    });
    canvas.addEventListener('pointermove', event => {
      if (this.pointerDown && Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 6) this.pointerDown = undefined;
      if (event.buttons !== 0 || event.pointerType === 'touch') return;
      this.pendingHover = { x: event.clientX, y: event.clientY };
      this.start();
    });
    canvas.addEventListener('pointerleave', () => { this.setHover(0); this.callbacks.onhover(undefined, 0, 0); this.callbacks.onfeature?.(undefined, 0, 0); });
  }

  private pickPin(clientX: number, clientY: number): MapPin | undefined {
    if (!this.pointOverlay || !this.pointProjection) return undefined;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    for (const pin of this.pointOverlay.pins) {
      const point = projectLonLat(this.pointProjection, pin.lon, pin.lat);
      const height = (this.terrain?.surfaceAt(point.x, point.y) ?? 0) + 4;
      const screen = world(point.x, point.y, height).project(this.camera);
      if (screen.z < -1 || screen.z > 1) continue;
      const x = bounds.left + (screen.x + 1) * bounds.width / 2;
      const y = bounds.top + (1 - screen.y) * bounds.height / 2;
      if (Math.hypot(clientX - x, clientY - y) <= 13) return pin;
    }
    return undefined;
  }

  private setHover(id: number): void {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.updatePalette();
  }

  /** Marches the view ray across the height field and reads the region id under the hit. */
  private pick(clientX: number, clientY: number): RegionEntry | undefined {
    const terrain = this.terrain;
    if (!terrain) return undefined;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new Vector2(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const { origin, direction } = this.raycaster.ray;
    if (direction.y >= 0) return undefined;
    const top = (20 - origin.y) / direction.y;
    const bottom = (0 - origin.y) / direction.y;
    const start = Math.max(0, top);
    const steps = 240;
    for (let step = 0; step <= steps; step++) {
      const distance = start + ((bottom - start) * step) / steps;
      const point = origin.clone().addScaledVector(direction, distance);
      const x = point.x + MAP_CENTER.x;
      const y = point.z + MAP_CENTER.y;
      if (x < 0 || x > PLANE_WIDTH || y < 0 || y > PLANE_HEIGHT) continue;
      if (point.y > terrain.surfaceAt(x, y)) continue;
      let id = this.detailIndex.sample(x, y);
      if (id === 0) id = this.baseIndex.sample(x, y);
      return this.byId.get(id);
    }
    return undefined;
  }

  // --- loop ---------------------------------------------------------------------------------

  private readonly onVisibility = () => { if (!document.hidden) this.start(); };

  private invalidate(): void {
    this.dirty = true;
    this.start();
  }

  private start(): void {
    if (this.frame || this.disposed || this.rendering) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.frame = 0;
    if (this.disposed) return;
    this.rendering = true;
    const delta = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const animating = !this.reducedMotion;
    if (animating) this.elapsed += delta;
    this.stepFlight(now);
    if (this.controls.update()) this.dirty = true;

    if (this.pendingHover) {
      const region = this.pick(this.pendingHover.x, this.pendingHover.y);
      const pin = this.pickPin(this.pendingHover.x, this.pendingHover.y);
      this.callbacks.onfeature?.(pin, this.pendingHover.x, this.pendingHover.y);
      this.setHover(region?.id ?? 0);
      this.callbacks.onhover(region?.code, this.pendingHover.x, this.pendingHover.y);
      this.pendingHover = undefined;
    }

    if (animating) {
      const meanU = this.fieldA.meanU * (1 - this.weatherMix) + this.fieldB.meanU * this.weatherMix;
      const meanV = this.fieldA.meanV * (1 - this.weatherMix) + this.fieldB.meanV * this.weatherMix;
      // Cloud texture drifts with the regional mean wind (km/h scaled to map units per second).
      this.cloudDrift.x += meanU * delta * 0.0045;
      this.cloudDrift.y += meanV * delta * 0.0045;
      this.updateLightning(delta);
      if (this.layers.wind) this.windParticles.step(delta);
      if (this.layers.weather) this.rain.step(delta);
    }
    for (const material of this.cloudMaterials) {
      material.uniforms.time.value = this.elapsed;
      material.uniforms.drift.value.copy(this.cloudDrift).multiplyScalar(material.uniforms.scale.value * 60);
      material.uniforms.flash.value = this.flash;
      material.uniforms.flashPosition.value.copy(this.flashPosition);
    }
    if (this.seaMaterial) {
      let seaTime = 0;
      if (this.layers.sea) seaTime = this.elapsed;
      this.seaMaterial.uniforms.time.value = seaTime;
      this.seaMaterial.uniforms.flash.value = this.flash;
    }
    if (this.terrainMaterial) this.terrainMaterial.uniforms.flash.value = this.flash;
    if (this.cloudVeil) {
      const x = this.camera.position.x + MAP_CENTER.x;
      const y = this.camera.position.z + MAP_CENTER.y;
      const coverage = sampleChannel(this.fieldA, this.fieldA.cloud, x, y) * (1 - this.weatherMix)
        + sampleChannel(this.fieldB, this.fieldB.cloud, x, y) * this.weatherMix;
      let density = 0;
      const deckDistance = (this.camera.position.y - 27) / 5;
      if (this.layers.weather && !this.reducedMotion) density = Math.exp(-(deckDistance * deckDistance)) * coverage * 0.9;
      this.cloudVeil.uniforms.density.value = density;
      this.cloudVeil.uniforms.time.value = this.elapsed;
    }

    if (animating || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    const keepGoing = animating || this.flight !== undefined || this.controls.enableDamping;
    this.rendering = false;
    if (this.visible && !document.hidden && keepGoing) this.frame = requestAnimationFrame(this.tick);
  };

  /** Thunderstorm points flicker briefly; frequency is modest so it informs rather than distracts. */
  private updateLightning(delta: number): void {
    this.flash *= Math.exp(-delta * 9);
    let storms: { x: number; y: number }[] = [];
    if (this.layers.weather) storms = this.fieldA.thunder;
    if (storms.length === 0 || this.random() > delta * 0.6) return;
    const storm = storms[Math.floor(this.random() * storms.length)];
    this.flashPosition.copy(world(storm.x, storm.y, 26));
    this.flash = 1;
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    this.start();
  }
}

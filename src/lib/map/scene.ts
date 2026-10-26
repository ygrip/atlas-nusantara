import {
  BufferAttribute, BufferGeometry, Color, DataTexture, LinearFilter, LineBasicMaterial,
  LineSegments, Mesh, NearestFilter, PerspectiveCamera, RGBAFormat, Raycaster,
  Points, Scene, ShaderMaterial, Spherical, Vector2, Vector3, WebGLRenderer
} from 'three';
import { visualRandom } from './random';
import { RegionIndex } from './region-index';
import { CAMERA_LIMITS, fitMapDistance } from './camera';
import { WindParticles, RainStreaks, type ViewRect } from './particles';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { GeometryPackage } from '$lib/geo/types';
import type { MapPin, PointOverlay } from './overlay-contract';
import { projectLonLat } from './geometry';
import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
import { MAP_CENTER, parseRings } from './geometry';
import { TerrainModel } from './terrain';
import { FIELD_HEIGHT, FIELD_WIDTH, packField, PLANE_HEIGHT, PLANE_WIDTH, sampleChannel, type WeatherField } from './weather';
import { CLOUD_BASE_HEIGHT, CLOUD_TOP_HEIGHT } from './layout';
import { THEMES, type ThemeName } from './themes';
import { applyThemeToShared, createSharedUniforms, type SharedUniforms } from './shared-uniforms';
import { SpaceBackdrop } from './space';
import { Sea } from './sea';
import { TerrainSurface } from './terrain-mesh';
import { CloudLayers } from './clouds';
import { createPinPoints, pinHeight } from './pins';

export type { ThemeName } from './themes';
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

/** Default camera tilt (radians from straight down): steep enough to show relief and the rolled-over edge of the world. */
const HOME_TILT = 0.88;
const MAX_TILT = 1.3;
const PICK_RADIUS_PIXELS = 16;
/** Map units per second the cloud pattern travels per km/h of mean wind. */
const CLOUD_UNITS_PER_KMH = 0.12;
/** Must match the noise scale in cloudBillows (glsl-common.ts). */
const CLOUD_NOISE_SCALE = 0.011;
const CLOUD_MID_HEIGHT = (CLOUD_BASE_HEIGHT + CLOUD_TOP_HEIGHT) / 2;
const CLOUD_HALF_THICKNESS = (CLOUD_TOP_HEIGHT - CLOUD_BASE_HEIGHT) / 2;

// Region emphasis written to the palette alpha: how strongly the island-group colour tints the terrain.
const TINT_BASE = 0.3;
const TINT_DIMMED = 0.15;
const TINT_HOVER = 0.65;
const TINT_SELECTED = 1;

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

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * The atlas as a small world floating in space: relief land under a wind-driven ocean that rolls over a rounded
 * edge, volumetric clouds, rain and wind streamlines from a dated forecast snapshot, and a starfield beyond.
 * Renders only while visible.
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
  private terrainSurface: TerrainSurface | undefined;
  private sea: Sea | undefined;
  private clouds: CloudLayers | undefined;
  private readonly space: SpaceBackdrop;
  private borderLines: LineSegments | undefined;
  private cityLines: LineSegments | undefined;
  private observationPoints: Points | undefined;
  private pointOverlay: PointOverlay | undefined;
  private pointProjection: GeometryPackage['projection'];
  private readonly compact: boolean;
  private readonly baseIndex = new RegionIndex(ID_WIDTH, ID_HEIGHT);
  private readonly detailIndex = new RegionIndex(2048, 2048);
  private paletteData = new Uint8Array(256 * 4);
  private paletteTexture: DataTexture;
  private weatherA: DataTexture;
  private weatherB: DataTexture;
  private readonly shared: SharedUniforms;
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
  /** Accumulated cloud travel in map units, kept in double precision. */
  private readonly cloudTravel = new Vector2();
  private readonly random = visualRandom(6117);
  private flash = 0;
  private flashPosition = new Vector3();
  private pointerDown: { x: number; y: number } | undefined;
  private activePointers = new Set<number>();
  private pendingHover: { x: number; y: number } | undefined;

  constructor(private readonly container: HTMLElement, private readonly callbacks: SceneCallbacks, private readonly reducedMotion: boolean) {
    this.compact = window.innerWidth < 700;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    let pixelRatioLimit = 2;
    if (this.compact) pixelRatioLimit = 1.5;
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
    this.controls.maxPolarAngle = MAX_TILT;
    this.controls.addEventListener('change', () => { this.invalidate(); this.emitZoom(); });

    this.paletteTexture = new DataTexture(this.paletteData, 256, 1, RGBAFormat);
    this.paletteTexture.magFilter = NearestFilter;
    this.paletteTexture.minFilter = NearestFilter;
    this.weatherA = fieldTexture(this.fieldA);
    this.weatherB = fieldTexture(this.fieldB);
    this.shared = createSharedUniforms(THEMES.light, this.weatherA, this.weatherB);

    this.space = new SpaceBackdrop(this.shared, THEMES.light);
    this.scene.add(this.space.dome, this.space.halo);

    this.windParticles = new WindParticles(this.compact);
    this.rain = new RainStreaks(this.compact);
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
    const colors = THEMES[this.theme];
    this.terrain = new TerrainModel(relief.elevation, relief.width, relief.height, mask, maskSize[0], maskSize[1]);
    this.provinces = national.regions.map((region, index) => ({
      id: index + 1, code: region.sourceCode, name: region.name, bbox: region.bbox as [number, number, number, number],
      rings: parseRings(region.path), level: 'province'
    }));
    this.rebuildIndex();
    this.rasteriseIds();

    this.sea = new Sea(this.shared, colors, relief, mask, maskSize);
    this.sea.update(Number.POSITIVE_INFINITY, this.meanWind(), false);
    this.scene.add(this.sea.mesh);

    this.terrainSurface = new TerrainSurface(this.terrain, this.shared, colors, {
      regionIds: this.baseIndex.texture, detailIds: this.detailIndex.texture, detailBounds: this.detailIndex.bounds, palette: this.paletteTexture
    }, this.compact);
    this.scene.add(this.terrainSurface.mesh);

    this.clouds = new CloudLayers(this.shared, colors, this.compact);
    this.clouds.setVisible(this.layers.weather);
    this.scene.add(this.clouds.volume, this.clouds.cirrus, this.clouds.veil);

    this.borderLines = this.buildBorders(this.provinces, colors.border, 0.85, 0.35);
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
    this.observationPoints = createPinPoints(overlay, projection, this.terrain, this.shared.time, this.renderer.getPixelRatio());
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
    this.shared.weatherMix.value = mix;
    this.windParticles.setFields(this.fieldA, this.fieldB, mix);
    this.rain.setFields(this.fieldA, this.fieldB, mix);
    this.invalidate();
  }

  setLayers(layers: MapLayers): void {
    this.layers = layers;
    this.windParticles.lines.visible = layers.wind;
    this.rain.lines.visible = layers.weather;
    this.clouds?.setVisible(layers.weather);
    this.shared.cloudStrength.value = 0;
    if (layers.weather) this.shared.cloudStrength.value = 1;
    this.invalidate();
  }

  applyTheme(theme: ThemeName): void {
    this.theme = theme;
    const colors = THEMES[theme];
    applyThemeToShared(this.shared, colors);
    this.renderer.setClearColor(colors.space);
    this.space.setTheme(colors);
    this.sea?.setTheme(colors);
    this.terrainSurface?.setTheme(colors);
    this.clouds?.setTheme(colors);
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
    else spherical.phi = HOME_TILT;
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
    this.shared.fogNear.value = Math.max(1400, this.homeDistance * 1.4);
    this.shared.fogFar.value = Math.max(3600, this.homeDistance * 3.2);
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
    this.sea?.dispose();
    this.terrainSurface?.dispose();
    for (const texture of [this.paletteTexture, this.weatherA, this.weatherB]) texture.dispose();
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

  /**
   * Palette per region id. RGB is the island-group clay tone (dimmed outside the open province, terracotta when selected);
   * alpha is how strongly that colour tints the realistic land colour, so the selection stands out but the relief stays natural.
   */
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
      let tint = TINT_BASE;
      if (this.openProvince && region.level === 'province' && region.code !== this.openProvince) {
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        color = new Color().setHSL(hsl.h, hsl.s * 0.35, hsl.l * 0.92);
        tint = TINT_DIMMED;
      }
      if (region.code === this.selectedCode || (region.level === 'province' && region.code === this.openProvince && this.cities.length === 0)) {
        color = SELECTED_COLOR.clone();
        tint = TINT_SELECTED;
      }
      if (region.id === this.hoverId) {
        color.offsetHSL(0, 0.04, 0.07);
        tint = Math.max(tint, TINT_HOVER);
      }
      data[region.id * 4] = Math.round(color.r * 255);
      data[region.id * 4 + 1] = Math.round(color.g * 255);
      data[region.id * 4 + 2] = Math.round(color.b * 255);
      data[region.id * 4 + 3] = Math.round(tint * 255);
    }
    this.paletteTexture.needsUpdate = true;
    this.invalidate();
  }

  private replaceWeatherTexture(slot: 'A' | 'B', field: WeatherField): void {
    const texture = fieldTexture(field);
    if (slot === 'A') { this.weatherA.dispose(); this.weatherA = texture; this.shared.weatherA.value = texture; }
    else { this.weatherB.dispose(); this.weatherB = texture; this.shared.weatherB.value = texture; }
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
    if (!Number.isFinite(spherical.radius) || spherical.radius < 1) spherical.set(1, HOME_TILT, 0);
    if (spherical.phi < 0.05) spherical.phi = 0.01;
    else spherical.phi = Math.min(1.0, Math.max(0.5, spherical.phi));
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
      const screen = world(point.x, point.y, pinHeight(this.terrain, point.x, point.y)).project(this.camera);
      if (screen.z < -1 || screen.z > 1) continue;
      const x = bounds.left + (screen.x + 1) * bounds.width / 2;
      const y = bounds.top + (1 - screen.y) * bounds.height / 2;
      if (Math.hypot(clientX - x, clientY - y) <= PICK_RADIUS_PIXELS) return pin;
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

  private meanWind(): { u: number; v: number } {
    return {
      u: lerp(this.fieldA.meanU, this.fieldB.meanU, this.weatherMix),
      v: lerp(this.fieldA.meanV, this.fieldB.meanV, this.weatherMix)
    };
  }

  private handlePendingHover(): void {
    if (!this.pendingHover) return;
    const region = this.pick(this.pendingHover.x, this.pendingHover.y);
    const pin = this.pickPin(this.pendingHover.x, this.pendingHover.y);
    this.callbacks.onfeature?.(pin, this.pendingHover.x, this.pendingHover.y);
    this.setHover(region?.id ?? 0);
    this.callbacks.onhover(region?.code, this.pendingHover.x, this.pendingHover.y);
    this.pendingHover = undefined;
  }

  /** Advances sea, clouds, wind, rain and lightning. Without animation the sea only turns to face the current wind. */
  private advanceWeather(delta: number, animating: boolean): void {
    const wind = this.meanWind();
    let turnTime = Number.POSITIVE_INFINITY;
    if (animating) turnTime = delta;
    this.sea?.update(turnTime, wind, animating && this.layers.sea);
    this.clouds?.setWind(wind);
    if (!animating) return;
    // The cloud pattern drifts with the regional mean wind (km/h scaled to map units per second).
    this.cloudTravel.x += wind.u * delta * CLOUD_UNITS_PER_KMH;
    this.cloudTravel.y += wind.v * delta * CLOUD_UNITS_PER_KMH;
    this.shared.cloudDrift.value.set(this.cloudTravel.x * CLOUD_NOISE_SCALE, this.cloudTravel.y * CLOUD_NOISE_SCALE);
    this.updateLightning(delta);
    if (this.layers.wind) this.windParticles.step(delta);
    if (this.layers.weather) this.rain.step(delta);
  }

  /** Keeps wind and rain particles inside the visible part of the map so their density is steady at every zoom. */
  private updateParticleView(): void {
    const target = this.controls.target;
    const distance = this.camera.position.distanceTo(target);
    const halfHeight = distance * Math.tan((CAMERA_LIMITS.fov * Math.PI) / 360) * 1.7;
    const halfWidth = halfHeight * Math.max(this.camera.aspect, 0.6);
    const centerX = target.x + MAP_CENTER.x;
    const centerY = target.z + MAP_CENTER.y;
    const view: ViewRect = {
      minX: Math.max(0, centerX - halfWidth), maxX: Math.min(PLANE_WIDTH, centerX + halfWidth),
      minY: Math.max(0, centerY - halfHeight), maxY: Math.min(PLANE_HEIGHT, centerY + halfHeight)
    };
    const coversMap = view.maxX - view.minX >= PLANE_WIDTH && view.maxY - view.minY >= PLANE_HEIGHT;
    if (view.maxX <= view.minX || view.maxY <= view.minY || coversMap) {
      this.windParticles.setView(undefined);
      this.rain.setView(undefined);
      return;
    }
    this.windParticles.setView(view);
    this.rain.setView(view);
  }

  /** A whiteout veil while the camera is inside the cloud slab, scaled by the forecast cover below the camera. */
  private updateCloudVeil(): void {
    if (!this.clouds) return;
    const x = this.camera.position.x + MAP_CENTER.x;
    const y = this.camera.position.z + MAP_CENTER.y;
    const coverage = sampleChannel(this.fieldA, this.fieldA.cloud, x, y) * (1 - this.weatherMix)
      + sampleChannel(this.fieldB, this.fieldB.cloud, x, y) * this.weatherMix;
    let density = 0;
    const deckDistance = (this.camera.position.y - CLOUD_MID_HEIGHT) / (CLOUD_HALF_THICKNESS * 0.9);
    if (this.layers.weather && !this.reducedMotion) density = Math.exp(-(deckDistance * deckDistance)) * coverage * 0.9;
    this.clouds.setVeilDensity(density);
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
    this.handlePendingHover();
    this.updateParticleView();
    this.advanceWeather(delta, animating);
    this.shared.time.value = this.elapsed;
    this.shared.flash.value = this.flash;
    this.shared.flashPosition.value.copy(this.flashPosition);
    this.updateCloudVeil();
    this.space.follow(this.camera);

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
    this.flashPosition.copy(world(storm.x, storm.y, CLOUD_BASE_HEIGHT));
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

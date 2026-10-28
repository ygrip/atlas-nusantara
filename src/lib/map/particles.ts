import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, LineSegments, NormalBlending, ShaderMaterial } from 'three';
import type { TerrainModel } from './terrain';
import { MAP_CENTER } from './geometry';
import { CLOUD_BASE_HEIGHT } from './layout';
import { PLANE_WIDTH, PLANE_HEIGHT, sampleChannel, type WeatherField } from './weather';
import { streakVertex, streakFragment } from './shaders';
import { visualRandom } from './random';
import type { ThemeName } from './themes';

/** The part of the map plane that particles should fill (SVG plane coordinates). */
export interface ViewRect { minX: number; minY: number; maxX: number; maxY: number }

const FULL_VIEW: ViewRect = { minX: 0, minY: 0, maxX: PLANE_WIDTH, maxY: PLANE_HEIGHT };

/** Map units per second a particle travels per km/h of wind. */
const WIND_UNITS_PER_KMH = 0.5;
/** Seconds between recorded trail samples. Trails are drawn as a smooth sliding window over the samples. */
const SAMPLE_INTERVAL = 0.14;

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Wind streamlines: particles advected through the gridded forecast wind (midpoint integration, so curved flow stays
 * smooth), drawn as fading trails coloured by speed like a wind map. Particles spawn only inside the visible part of
 * the map, so the on-screen density stays steady as you zoom.
 */
export class WindParticles {
  private readonly random = visualRandom(1980);
  readonly lines: LineSegments;
  private readonly count: number;
  private readonly trail = 8;
  /** Recorded samples per particle (x, y) and the ground height under each. */
  private readonly samples: Float32Array;
  private readonly sampleHeights: Float32Array;
  private readonly head: Float32Array;
  private readonly headHeight: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly colors: Float32Array;
  private terrain: TerrainModel | undefined;
  private fieldA: WeatherField | undefined;
  private fieldB: WeatherField | undefined;
  private mix = 0;
  private dark = false;
  private view: ViewRect = FULL_VIEW;
  private sampleClock = 0;

  constructor(compact: boolean) {
    this.count = 900;
    if (compact) this.count = 450;
    this.samples = new Float32Array(this.count * this.trail * 2);
    this.sampleHeights = new Float32Array(this.count * this.trail);
    this.head = new Float32Array(this.count * 2);
    this.headHeight = new Float32Array(this.count);
    this.age = new Float32Array(this.count);
    this.life = new Float32Array(this.count);
    const vertices = this.count * (this.trail - 1) * 2;
    this.positions = new Float32Array(vertices * 3);
    this.alphas = new Float32Array(vertices);
    this.colors = new Float32Array(vertices * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1).setUsage(DynamicDrawUsage));
    geometry.setAttribute('color', new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage));
    const material = new ShaderMaterial({ vertexShader: streakVertex, fragmentShader: streakFragment, transparent: true, depthWrite: false, uniforms: { opacity: { value: 0.9 } } });
    this.lines = new LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
    for (let index = 0; index < this.count; index++) this.respawn(index, this.random());
  }

  attach(terrain: TerrainModel): void { this.terrain = terrain; }

  setTheme(theme: ThemeName): void {
    this.dark = theme === 'dark';
    const material = this.lines.material as ShaderMaterial;
    material.blending = NormalBlending;
    if (this.dark) material.blending = AdditiveBlending;
    material.needsUpdate = true;
  }

  /** Limits spawning to the visible rectangle; pass undefined for the whole map. */
  setView(view: ViewRect | undefined): void {
    this.view = view ?? FULL_VIEW;
  }

  setFields(a: WeatherField, b: WeatherField, mix: number, prime = false): void {
    const first = this.fieldA === undefined;
    this.fieldA = a;
    this.fieldB = b;
    this.mix = mix;
    // Pre-roll so reduced-motion and first frames already show trails.
    if (first || prime) for (let step = 0; step < 24; step++) this.step(1 / 30);
  }

  private wind(x: number, y: number): [number, number] {
    if (!this.fieldA || !this.fieldB) return [0, 0];
    const u = sampleChannel(this.fieldA, this.fieldA.u, x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB.u, x, y) * this.mix;
    const v = sampleChannel(this.fieldA, this.fieldA.v, x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB.v, x, y) * this.mix;
    return [u, v];
  }

  private groundHeight(x: number, y: number): number {
    if (!this.terrain) return 5;
    return this.terrain.surfaceAt(x, y) + 4.5;
  }

  private respawn(index: number, ageFraction = 0): void {
    const view = this.view;
    const x = lerp(view.minX, view.maxX, this.random());
    const y = lerp(view.minY, view.maxY, this.random());
    const height = this.groundHeight(x, y);
    this.head[index * 2] = x;
    this.head[index * 2 + 1] = y;
    this.headHeight[index] = height;
    for (let point = 0; point < this.trail; point++) {
      this.samples[(index * this.trail + point) * 2] = x;
      this.samples[(index * this.trail + point) * 2 + 1] = y;
      this.sampleHeights[index * this.trail + point] = height;
    }
    this.life[index] = 2.5 + this.random() * 3.5;
    this.age[index] = this.life[index] * ageFraction;
  }

  /** km/h → colour ramp matching the legend: calm white, breeze mint, fresh amber, strong coral. */
  private speedColor(speed: number): [number, number, number] {
    const stops: [number, [number, number, number]][] = [[0, [1, 1, 1]], [12, [0.75, 0.95, 0.88]], [25, [1, 0.86, 0.5]], [40, [1, 0.55, 0.42]]];
    for (let index = 1; index < stops.length; index++) {
      if (speed > stops[index][0]) continue;
      const [s0, c0] = stops[index - 1];
      const [s1, c1] = stops[index];
      const t = (speed - s0) / (s1 - s0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
    return stops[stops.length - 1][1];
  }

  /** Records the live head as the newest trail sample and drops the oldest one. */
  private recordSamples(): void {
    for (let index = 0; index < this.count; index++) {
      const base = index * this.trail;
      for (let point = 0; point < this.trail - 1; point++) {
        this.samples[(base + point) * 2] = this.samples[(base + point + 1) * 2];
        this.samples[(base + point) * 2 + 1] = this.samples[(base + point + 1) * 2 + 1];
        this.sampleHeights[base + point] = this.sampleHeights[base + point + 1];
      }
      const last = base + this.trail - 1;
      this.samples[last * 2] = this.head[index * 2];
      this.samples[last * 2 + 1] = this.head[index * 2 + 1];
      this.sampleHeights[last] = this.headHeight[index];
    }
  }

  private isInsideView(x: number, y: number): boolean {
    const view = this.view;
    return x >= view.minX && x <= view.maxX && y >= view.minY && y <= view.maxY;
  }

  /** Midpoint (RK2) advection of one particle's head by `delta` seconds. */
  private advect(index: number, delta: number): void {
    const x = this.head[index * 2];
    const y = this.head[index * 2 + 1];
    const [firstU, firstV] = this.wind(x, y);
    const halfStep = delta * 0.5 * WIND_UNITS_PER_KMH;
    const [midU, midV] = this.wind(x + firstU * halfStep, y + firstV * halfStep);
    const nextX = x + midU * delta * WIND_UNITS_PER_KMH;
    const nextY = y + midV * delta * WIND_UNITS_PER_KMH;
    this.head[index * 2] = nextX;
    this.head[index * 2 + 1] = nextY;
    this.headHeight[index] = this.groundHeight(nextX, nextY);
  }

  step(delta: number): void {
    this.sampleClock += delta;
    while (this.sampleClock >= SAMPLE_INTERVAL) {
      this.recordSamples();
      this.sampleClock -= SAMPLE_INTERVAL;
    }
    for (let index = 0; index < this.count; index++) {
      this.age[index] += delta;
      const x = this.head[index * 2];
      const y = this.head[index * 2 + 1];
      const inPlane = x >= 0 && x <= PLANE_WIDTH && y >= 0 && y <= PLANE_HEIGHT;
      if (this.age[index] > this.life[index] || !inPlane || !this.isInsideView(x, y)) { this.respawn(index); continue; }
      this.advect(index, delta);
    }
    this.writeGeometry();
  }

  /** The trail is a sliding window: older vertices slide toward the next sample as the clock approaches the next tick. */
  private writeGeometry(): void {
    const slide = this.sampleClock / SAMPLE_INTERVAL;
    let vertex = 0;
    for (let index = 0; index < this.count; index++) {
      const lifeFraction = this.age[index] / this.life[index];
      const fade = Math.min(1, lifeFraction * 4) * Math.min(1, (1 - lifeFraction) * 4);
      const [u, v] = this.wind(this.head[index * 2], this.head[index * 2 + 1]);
      const speed = Math.hypot(u, v);
      const [r, g, b] = this.speedColor(speed);
      const calmFade = Math.min(1, speed / 5);
      const base = index * this.trail;
      for (let point = 0; point < this.trail - 1; point++) {
        for (let end = 0; end < 2; end++) {
          const trailIndex = point + end;
          const x = this.trailX(base, trailIndex, slide, index);
          const y = this.trailY(base, trailIndex, slide, index);
          const height = this.trailHeight(base, trailIndex, slide, index);
          this.positions[vertex * 3] = x - MAP_CENTER.x;
          this.positions[vertex * 3 + 1] = height;
          this.positions[vertex * 3 + 2] = y - MAP_CENTER.y;
          const along = trailIndex / (this.trail - 1);
          this.alphas[vertex] = fade * calmFade * along ** 1.4 * 0.95;
          this.colors[vertex * 3] = r;
          this.colors[vertex * 3 + 1] = g;
          this.colors[vertex * 3 + 2] = b;
          vertex++;
        }
      }
    }
    const geometry = this.lines.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  private trailX(base: number, trailIndex: number, slide: number, index: number): number {
    if (trailIndex === this.trail - 1) return this.head[index * 2];
    return lerp(this.samples[(base + trailIndex) * 2], this.samples[(base + trailIndex + 1) * 2], slide);
  }

  private trailY(base: number, trailIndex: number, slide: number, index: number): number {
    if (trailIndex === this.trail - 1) return this.head[index * 2 + 1];
    return lerp(this.samples[(base + trailIndex) * 2 + 1], this.samples[(base + trailIndex + 1) * 2 + 1], slide);
  }

  private trailHeight(base: number, trailIndex: number, slide: number, index: number): number {
    if (trailIndex === this.trail - 1) return this.headHeight[index];
    return lerp(this.sampleHeights[base + trailIndex], this.sampleHeights[base + trailIndex + 1], slide);
  }
}

/** Rain streaks fall from the cloud base where the forecast says it rains, slanted by the wind. */
export class RainStreaks {
  private readonly random = visualRandom(2025);
  readonly lines: LineSegments;
  private readonly count: number;
  private readonly drops: Float32Array;
  private readonly strength: Float32Array;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private terrain: TerrainModel | undefined;
  private fieldA: WeatherField | undefined;
  private fieldB: WeatherField | undefined;
  private mix = 0;
  private view: ViewRect = FULL_VIEW;

  constructor(compact: boolean) {
    this.count = 2200;
    if (compact) this.count = 1000;
    this.drops = new Float32Array(this.count * 3);
    this.strength = new Float32Array(this.count);
    this.positions = new Float32Array(this.count * 6);
    this.alphas = new Float32Array(this.count * 2);
    const colors = new Float32Array(this.count * 6);
    for (let vertex = 0; vertex < this.count * 2; vertex++) {
      colors[vertex * 3] = 0.8;
      colors[vertex * 3 + 1] = 0.88;
      colors[vertex * 3 + 2] = 1;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1).setUsage(DynamicDrawUsage));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = new ShaderMaterial({ vertexShader: streakVertex, fragmentShader: streakFragment, transparent: true, depthWrite: false, uniforms: { opacity: { value: 0.6 } } });
    this.lines = new LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
  }

  attach(terrain: TerrainModel): void { this.terrain = terrain; }

  setView(view: ViewRect | undefined): void {
    this.view = view ?? FULL_VIEW;
  }

  setFields(a: WeatherField, b: WeatherField, mix: number): void {
    const changed = this.fieldA !== a || this.fieldB !== b;
    this.fieldA = a;
    this.fieldB = b;
    this.mix = mix;
    if (changed) {
      for (let index = 0; index < this.count; index++) this.respawn(index, this.random() * CLOUD_BASE_HEIGHT);
      this.step(0);
    }
  }

  private sample(channel: 'u' | 'v' | 'rain', x: number, y: number): number {
    if (!this.fieldA || !this.fieldB) return 0;
    return sampleChannel(this.fieldA, this.fieldA[channel], x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB[channel], x, y) * this.mix;
  }

  /** Rejection sampling: drops appear in proportion to rain intensity; without rain they stay parked. */
  private respawn(index: number, height = CLOUD_BASE_HEIGHT): void {
    this.strength[index] = 0;
    const view = this.view;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = lerp(view.minX, view.maxX, this.random());
      const y = lerp(view.minY, view.maxY, this.random());
      const rain = this.sample('rain', x, y);
      if (this.random() > rain) continue;
      this.drops[index * 3] = x;
      this.drops[index * 3 + 1] = y;
      this.drops[index * 3 + 2] = height;
      this.strength[index] = rain;
      return;
    }
  }

  step(delta: number): void {
    for (let index = 0; index < this.count; index++) {
      if (this.strength[index] <= 0) {
        if (this.random() < delta * 2) this.respawn(index);
        this.alphas[index * 2] = 0;
        this.alphas[index * 2 + 1] = 0;
        continue;
      }
      const x = this.drops[index * 3];
      const y = this.drops[index * 3 + 1];
      const u = this.sample('u', x, y);
      const v = this.sample('v', x, y);
      const fall = 34 * delta;
      const nextX = x + u * delta * 0.05;
      const nextY = y + v * delta * 0.05;
      const height = this.drops[index * 3 + 2] - fall;
      let ground = 0;
      if (this.terrain) ground = this.terrain.surfaceAt(nextX, nextY);
      if (height <= ground) { this.respawn(index); continue; }
      this.drops[index * 3] = nextX;
      this.drops[index * 3 + 1] = nextY;
      this.drops[index * 3 + 2] = height;
      const slantX = u * 0.012;
      const slantY = v * 0.012;
      const length = 1.2 + this.strength[index] * 1.4;
      const base = index * 6;
      this.positions[base] = nextX - MAP_CENTER.x;
      this.positions[base + 1] = height;
      this.positions[base + 2] = nextY - MAP_CENTER.y;
      this.positions[base + 3] = nextX - MAP_CENTER.x - slantX;
      this.positions[base + 4] = height + length;
      this.positions[base + 5] = nextY - MAP_CENTER.y - slantY;
      this.alphas[index * 2] = Math.min(1, 0.35 + this.strength[index]);
      this.alphas[index * 2 + 1] = 0;
    }
    const geometry = this.lines.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  }
}

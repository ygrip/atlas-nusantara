import { AdditiveBlending, BufferAttribute, BufferGeometry, LineSegments, NormalBlending, ShaderMaterial } from 'three';
import type { TerrainModel } from './terrain';
import { MAP_CENTER } from './geometry';
import { PLANE_WIDTH, PLANE_HEIGHT, sampleChannel, type WeatherField } from './weather';
import { streakVertex, streakFragment } from './shaders';
import { visualRandom } from './random';
import type { ThemeName } from './scene';

/** Wind streaks advected through the gridded forecast wind, coloured by speed like a wind map. */
export class WindParticles {
  private readonly random = visualRandom(1980);
  readonly lines: LineSegments;
  private readonly count: number;
  private readonly trail = 7;
  private readonly history: Float32Array;
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

  constructor(compact: boolean) {
    this.count = 2600;
    if (compact) this.count = 1300;
    this.history = new Float32Array(this.count * this.trail * 2);
    this.age = new Float32Array(this.count);
    this.life = new Float32Array(this.count);
    const vertices = this.count * (this.trail - 1) * 2;
    this.positions = new Float32Array(vertices * 3);
    this.alphas = new Float32Array(vertices);
    this.colors = new Float32Array(vertices * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1));
    geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
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
  }

  setFields(a: WeatherField, b: WeatherField, mix: number): void {
    const first = this.fieldA === undefined;
    this.fieldA = a;
    this.fieldB = b;
    this.mix = mix;
    // Pre-roll so reduced-motion and first frames already show trails.
    if (first) for (let step = 0; step < 40; step++) this.step(1 / 30);
  }

  private wind(x: number, y: number): [number, number] {
    if (!this.fieldA || !this.fieldB) return [0, 0];
    const u = sampleChannel(this.fieldA, this.fieldA.u, x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB.u, x, y) * this.mix;
    const v = sampleChannel(this.fieldA, this.fieldA.v, x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB.v, x, y) * this.mix;
    return [u, v];
  }

  private respawn(index: number, ageFraction = 0): void {
    const x = this.random() * PLANE_WIDTH;
    const y = this.random() * PLANE_HEIGHT;
    for (let point = 0; point < this.trail; point++) {
      this.history[(index * this.trail + point) * 2] = x;
      this.history[(index * this.trail + point) * 2 + 1] = y;
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

  step(delta: number): void {
    const terrain = this.terrain;
    for (let index = 0; index < this.count; index++) {
      this.age[index] += delta;
      const head = (index * this.trail + this.trail - 1) * 2;
      const x = this.history[head];
      const y = this.history[head + 1];
      if (this.age[index] > this.life[index] || x < 0 || x > PLANE_WIDTH || y < 0 || y > PLANE_HEIGHT) { this.respawn(index); continue; }
      const [u, v] = this.wind(x, y);
      // 1 km/h ≈ 0.42 map units per second: fast enough to read the flow, slow enough to follow.
      for (let point = 0; point < this.trail - 1; point++) {
        const target = (index * this.trail + point) * 2;
        this.history[target] = this.history[target + 2];
        this.history[target + 1] = this.history[target + 3];
      }
      this.history[head] = x + u * delta * 0.42;
      this.history[head + 1] = y + v * delta * 0.42;
    }
    this.writeGeometry(terrain);
  }

  private writeGeometry(terrain: TerrainModel | undefined): void {
    let vertex = 0;
    for (let index = 0; index < this.count; index++) {
      const lifeFraction = this.age[index] / this.life[index];
      const fade = Math.min(1, lifeFraction * 4) * Math.min(1, (1 - lifeFraction) * 4);
      const head = (index * this.trail + this.trail - 1) * 2;
      const [u, v] = this.wind(this.history[head], this.history[head + 1]);
      const [r, g, b] = this.speedColor(Math.hypot(u, v));
      for (let point = 0; point < this.trail - 1; point++) {
        for (let end = 0; end < 2; end++) {
          const source = (index * this.trail + point + end) * 2;
          const x = this.history[source];
          const y = this.history[source + 1];
          let height = 5;
          if (terrain) height = terrain.surfaceAt(x, y) + 4.5;
          this.positions[vertex * 3] = x - MAP_CENTER.x;
          this.positions[vertex * 3 + 1] = height;
          this.positions[vertex * 3 + 2] = y - MAP_CENTER.y;
          this.alphas[vertex] = fade * ((point + end) / this.trail) * 0.95;
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

  constructor(compact: boolean) {
    this.count = 5000;
    if (compact) this.count = 2200;
    this.drops = new Float32Array(this.count * 3);
    this.strength = new Float32Array(this.count);
    this.positions = new Float32Array(this.count * 6);
    this.alphas = new Float32Array(this.count * 2);
    const colors = new Float32Array(this.count * 6).fill(0.78);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('alpha', new BufferAttribute(this.alphas, 1));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = new ShaderMaterial({ vertexShader: streakVertex, fragmentShader: streakFragment, transparent: true, depthWrite: false, uniforms: { opacity: { value: 0.55 } } });
    this.lines = new LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
  }

  attach(terrain: TerrainModel): void { this.terrain = terrain; }

  setFields(a: WeatherField, b: WeatherField, mix: number): void {
    const changed = this.fieldA !== a || this.fieldB !== b;
    this.fieldA = a;
    this.fieldB = b;
    this.mix = mix;
    if (changed) {
      for (let index = 0; index < this.count; index++) this.respawn(index, this.random() * 24);
      this.step(0);
    }
  }

  private sample(channel: 'u' | 'v' | 'rain', x: number, y: number): number {
    if (!this.fieldA || !this.fieldB) return 0;
    return sampleChannel(this.fieldA, this.fieldA[channel], x, y) * (1 - this.mix) + sampleChannel(this.fieldB, this.fieldB[channel], x, y) * this.mix;
  }

  /** Rejection sampling: drops appear in proportion to rain intensity; without rain they stay parked. */
  private respawn(index: number, height = 24): void {
    this.strength[index] = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = this.random() * PLANE_WIDTH;
      const y = this.random() * PLANE_HEIGHT;
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
      const base = index * 6;
      this.positions[base] = nextX - MAP_CENTER.x;
      this.positions[base + 1] = height;
      this.positions[base + 2] = nextY - MAP_CENTER.y;
      this.positions[base + 3] = nextX - MAP_CENTER.x - slantX;
      this.positions[base + 4] = height + 1.6;
      this.positions[base + 5] = nextY - MAP_CENTER.y - slantY;
      this.alphas[index * 2] = this.strength[index];
      this.alphas[index * 2 + 1] = 0;
    }
    const geometry = this.lines.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  }
}

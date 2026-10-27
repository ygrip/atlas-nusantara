import { Color, DataTexture, LinearFilter, Mesh, RedFormat, ShaderMaterial, Vector2 } from 'three';
import { MAX_DEPTH_METRES } from './layout';
import { buildSeaGeometry } from './planet';
import { seaFragment, seaVertex } from './sea-shaders';
import { waveCount, wavePhasesAt } from './sea-waves';
import type { SharedUniforms } from './shared-uniforms';
import { boxBlur } from './terrain';
import type { MapTheme } from './themes';

export interface ReliefGrid {
  elevation: Float32Array;
  width: number;
  height: number;
}

const COAST_DOWNSAMPLE = 4;
const COAST_BLUR_RADIUS = 8;
const COAST_BLUR_PASSES = 2;
/** How fast the swell heading may turn toward a new wind direction, radians per second. */
const HEADING_TURN_RATE = 0.5;
/** Map units per second the chop travels per km/h of wind. */
const CHOP_SPEED_PER_KMH = 0.03;

function createByteTexture(data: Uint8Array, width: number, height: number): DataTexture {
  const texture = new DataTexture(data, width, height, RedFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Depth below sea level, square-root coded so shallow water keeps its precision in 8 bits. */
function createDepthTexture(relief: ReliefGrid): DataTexture {
  const depth = new Uint8Array(relief.width * relief.height);
  for (let index = 0; index < depth.length; index++) {
    const metres = Math.max(0, -relief.elevation[index]);
    depth[index] = Math.round(Math.sqrt(Math.min(1, metres / MAX_DEPTH_METRES)) * 255);
  }
  return createByteTexture(depth, relief.width, relief.height);
}

function createMaskTexture(mask: Float32Array, size: [number, number]): DataTexture {
  const bytes = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index++) bytes[index] = Math.round(mask[index] * 255);
  return createByteTexture(bytes, size[0], size[1]);
}

/**
 * A wide, soft "how much land is nearby" field. It tints water near coasts toward shallows and keeps broad
 * flat shelves far from land from turning into a bright teal slab with straight edges.
 */
function createCoastField(mask: Float32Array, size: [number, number]): DataTexture {
  const width = Math.floor(size[0] / COAST_DOWNSAMPLE);
  const height = Math.floor(size[1] / COAST_DOWNSAMPLE);
  const current = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      let sum = 0;
      for (let dy = 0; dy < COAST_DOWNSAMPLE; dy++) {
        for (let dx = 0; dx < COAST_DOWNSAMPLE; dx++) {
          sum += mask[(row * COAST_DOWNSAMPLE + dy) * size[0] + column * COAST_DOWNSAMPLE + dx];
        }
      }
      current[row * width + column] = sum / (COAST_DOWNSAMPLE * COAST_DOWNSAMPLE);
    }
  }
  for (let pass = 0; pass < COAST_BLUR_PASSES; pass++) boxBlur(current, width, height, COAST_BLUR_RADIUS);
  const bytes = new Uint8Array(width * height);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Math.round(Math.min(1, current[index]) * 255);
  return createByteTexture(bytes, width, height);
}

function shortestAngle(from: number, to: number): number {
  let difference = (to - from) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

/** The ocean surface: curved plate geometry plus the wave shader and its bathymetry textures. */
export class Sea {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly textures: DataTexture[];
  private readonly phases = new Float32Array(waveCount());
  private readonly windDirection = new Vector2(1, 0);
  private readonly flowOffset = new Vector2();
  private heading = 0;
  private clock = 0;

  constructor(shared: SharedUniforms, theme: MapTheme, relief: ReliefGrid, mask: Float32Array, maskSize: [number, number]) {
    const bathymetry = createDepthTexture(relief);
    const landMask = createMaskTexture(mask, maskSize);
    const coastField = createCoastField(mask, maskSize);
    this.textures = [bathymetry, landMask, coastField];
    this.material = new ShaderMaterial({
      vertexShader: seaVertex,
      fragmentShader: seaFragment(),
      uniforms: {
        ...shared,
        wavePhase: { value: this.phases },
        windDirection: { value: this.windDirection },
        flowOffset: { value: this.flowOffset },
        landMask: { value: landMask },
        bathymetry: { value: bathymetry },
        coastField: { value: coastField },
        shallowColor: { value: new Color(theme.shallow) },
        midColor: { value: new Color(theme.mid) },
        deepColor: { value: new Color(theme.deep) },
        scatterColor: { value: new Color(theme.scatter) },
        foamColor: { value: new Color(theme.foam) },
        haloColor: { value: new Color(theme.halo) },
        reveal: { value: 1 }
      }
    });
    this.mesh = new Mesh(buildSeaGeometry(), this.material);
    this.mesh.renderOrder = 0;
    this.mesh.frustumCulled = false;
  }

  /**
   * 0 hides the water, 1 shows it fully. In between the sea spreads outward from the coasts like a rising tide,
   * so it is drawn translucent only while a transition is running.
   */
  setReveal(reveal: number): void {
    this.material.uniforms.reveal.value = reveal;
    this.material.transparent = reveal < 1;
    this.mesh.visible = reveal > 0.001;
  }

  setTheme(theme: MapTheme): void {
    const uniforms = this.material.uniforms;
    uniforms.shallowColor.value.set(theme.shallow);
    uniforms.midColor.value.set(theme.mid);
    uniforms.deepColor.value.set(theme.deep);
    uniforms.scatterColor.value.set(theme.scatter);
    uniforms.foamColor.value.set(theme.foam);
    uniforms.haloColor.value.set(theme.halo);
  }

  /**
   * Advances the swell. `wind` is the regional mean wind in km/h (u east, v south). When `running` is false the sea
   * holds still (layer off or reduced motion) but still turns to face the current wind.
   */
  update(delta: number, wind: { u: number; v: number }, running: boolean): void {
    const speed = Math.hypot(wind.u, wind.v);
    if (speed > 1) {
      const target = Math.atan2(wind.v, wind.u);
      const maxTurn = HEADING_TURN_RATE * Math.max(delta, 0);
      const turn = shortestAngle(this.heading, target);
      this.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
      this.windDirection.set(Math.cos(this.heading), Math.sin(this.heading));
    }
    if (!running) return;
    this.clock += delta;
    this.flowOffset.addScaledVector(this.windDirection, Math.max(speed, 6) * CHOP_SPEED_PER_KMH * delta);
    wavePhasesAt(this.clock, this.phases);
  }

  dispose(): void {
    for (const texture of this.textures) texture.dispose();
  }
}

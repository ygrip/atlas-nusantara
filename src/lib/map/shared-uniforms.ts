import { Color, DataTexture, Vector2, Vector3 } from 'three';
import { SUN_DIRECTION } from './layout';
import type { MapTheme } from './themes';

/**
 * One set of uniform objects shared by every material of the scene. Because the same `{ value }`
 * objects are referenced by each material, updating `.value` once updates the sea, land, clouds and space together.
 */
export interface SharedUniforms {
  time: { value: number };
  sunDirection: { value: Vector3 };
  sunColor: { value: Color };
  skyZenith: { value: Color };
  skyHorizon: { value: Color };
  fogColor: { value: Color };
  fogNear: { value: number };
  fogFar: { value: number };
  weatherA: { value: DataTexture };
  weatherB: { value: DataTexture };
  weatherMix: { value: number };
  /** Cloud pattern offset in noise units (accumulated on the CPU in double precision). */
  cloudDrift: { value: Vector2 };
  /** 1 while the weather layer is shown, 0 when hidden; fades cloud shadows with it. */
  cloudStrength: { value: number };
  flash: { value: number };
  flashPosition: { value: Vector3 };
  [name: string]: { value: unknown };
}

export function createSharedUniforms(theme: MapTheme, weatherA: DataTexture, weatherB: DataTexture): SharedUniforms {
  const uniforms: SharedUniforms = {
    time: { value: 0 },
    sunDirection: { value: new Vector3(...SUN_DIRECTION).normalize() },
    sunColor: { value: new Color() },
    skyZenith: { value: new Color() },
    skyHorizon: { value: new Color() },
    fogColor: { value: new Color() },
    fogNear: { value: 1400 },
    fogFar: { value: 3600 },
    weatherA: { value: weatherA },
    weatherB: { value: weatherB },
    weatherMix: { value: 0 },
    cloudDrift: { value: new Vector2() },
    cloudStrength: { value: 1 },
    flash: { value: 0 },
    flashPosition: { value: new Vector3() }
  };
  applyThemeToShared(uniforms, theme);
  return uniforms;
}

export function applyThemeToShared(uniforms: SharedUniforms, theme: MapTheme): void {
  uniforms.sunColor.value.set(theme.sun).multiplyScalar(theme.sunIntensity);
  uniforms.skyZenith.value.set(theme.skyZenith);
  uniforms.skyHorizon.value.set(theme.skyHorizon);
  uniforms.fogColor.value.set(theme.haze);
}

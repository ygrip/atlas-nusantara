import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { cirrusFragment, cirrusVertex, cloudVeilFragment, cloudVeilVertex, cloudVolumeFragment, cloudVolumeVertex } from './cloud-shaders';
import { CIRRUS_HEIGHT, CLOUD_BASE_HEIGHT, CLOUD_TOP_HEIGHT } from './layout';
import type { SharedUniforms } from './shared-uniforms';
import type { MapTheme } from './themes';
import { PLANE_HEIGHT, PLANE_WIDTH } from './weather';

const VOLUME_STEPS = 8;
const COMPACT_VOLUME_STEPS = 4;
const CIRRUS_WIDTH = PLANE_WIDTH * 1.7;
const CIRRUS_DEPTH = PLANE_HEIGHT * 1.7;

function horizontalPlane(width: number, depth: number): PlaneGeometry {
  const geometry = new PlaneGeometry(width, depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * Cloud deck above the map: a ray-marched cumulus/storm slab, a thin cirrus sheet, and a veil that
 * whitens the screen while the camera is inside the slab. Everything is driven by the forecast cover and rain fields.
 */
export class CloudLayers {
  readonly volume: Mesh;
  readonly cirrus: Mesh;
  readonly veil: Mesh;
  private readonly volumeMaterial: ShaderMaterial;
  private readonly cirrusMaterial: ShaderMaterial;
  private readonly veilMaterial: ShaderMaterial;
  private readonly windAxis = new Vector2(1, 0);

  constructor(shared: SharedUniforms, theme: MapTheme, compact: boolean) {
    let steps = VOLUME_STEPS;
    if (compact) steps = COMPACT_VOLUME_STEPS;
    this.volumeMaterial = new ShaderMaterial({
      vertexShader: cloudVolumeVertex,
      fragmentShader: cloudVolumeFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        ...shared,
        litColor: { value: new Color(theme.cloudLit) },
        shadeColor: { value: new Color(theme.cloudShade) },
        stormColor: { value: new Color(theme.storm) },
        marchSteps: { value: steps }
      }
    });
    this.volume = new Mesh(horizontalPlane(PLANE_WIDTH, PLANE_HEIGHT), this.volumeMaterial);
    this.volume.position.y = (CLOUD_BASE_HEIGHT + CLOUD_TOP_HEIGHT) / 2;
    this.volume.renderOrder = 4;

    this.cirrusMaterial = new ShaderMaterial({
      vertexShader: cirrusVertex,
      fragmentShader: cirrusFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { ...shared, litColor: { value: new Color(theme.cloudLit) }, windAxis: { value: this.windAxis } }
    });
    this.cirrus = new Mesh(horizontalPlane(CIRRUS_WIDTH, CIRRUS_DEPTH), this.cirrusMaterial);
    this.cirrus.position.y = CIRRUS_HEIGHT;
    this.cirrus.renderOrder = 5;

    this.veilMaterial = new ShaderMaterial({
      vertexShader: cloudVeilVertex,
      fragmentShader: cloudVeilFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { time: shared.time, density: { value: 0 }, color: { value: new Color(theme.cloudLit) } }
    });
    this.veil = new Mesh(new PlaneGeometry(2, 2), this.veilMaterial);
    this.veil.frustumCulled = false;
    this.veil.renderOrder = 7;
  }

  setTheme(theme: MapTheme): void {
    for (const material of [this.volumeMaterial, this.cirrusMaterial]) material.uniforms.litColor.value.set(theme.cloudLit);
    this.volumeMaterial.uniforms.shadeColor.value.set(theme.cloudShade);
    this.volumeMaterial.uniforms.stormColor.value.set(theme.storm);
    this.veilMaterial.uniforms.color.value.set(theme.cloudLit);
  }

  setVisible(visible: boolean): void {
    this.volume.visible = visible;
    this.cirrus.visible = visible;
  }

  /** Cirrus streaks line up with the regional mean wind (u east, v south, km/h). */
  setWind(wind: { u: number; v: number }): void {
    const speed = Math.hypot(wind.u, wind.v);
    if (speed < 1) return;
    this.windAxis.set(wind.u / speed, wind.v / speed);
  }

  setVeilDensity(density: number): void {
    this.veilMaterial.uniforms.density.value = density;
  }
}

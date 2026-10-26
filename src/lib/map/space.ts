import { AdditiveBlending, BackSide, Color, DoubleSide, Mesh, ShaderMaterial, SphereGeometry, type Camera } from 'three';
import { buildHaloGeometry } from './planet';
import { haloFragment, haloVertex, spaceFragment, spaceVertex } from './space-shaders';
import type { SharedUniforms } from './shared-uniforms';
import type { MapTheme } from './themes';

const DOME_RADIUS = 9000;
/** Drawn after all opaque world geometry so early depth rejection skips every pixel the world covers. */
const DOME_RENDER_ORDER = 1000;

/** Starfield behind the world and a soft atmosphere ring around its limb. */
export class SpaceBackdrop {
  readonly dome: Mesh;
  readonly halo: Mesh;
  private readonly domeMaterial: ShaderMaterial;
  private readonly haloMaterial: ShaderMaterial;

  constructor(shared: SharedUniforms, theme: MapTheme) {
    this.domeMaterial = new ShaderMaterial({
      vertexShader: spaceVertex,
      fragmentShader: spaceFragment,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        time: shared.time, sunDirection: shared.sunDirection, sunColor: shared.sunColor,
        spaceColor: { value: new Color(theme.space) }, nebulaColor: { value: new Color(theme.nebula) },
        starBrightness: { value: theme.starBrightness }
      }
    });
    this.dome = new Mesh(new SphereGeometry(DOME_RADIUS, 32, 16), this.domeMaterial);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = DOME_RENDER_ORDER;

    this.haloMaterial = new ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      uniforms: { time: shared.time, haloColor: { value: new Color(theme.halo) }, haloStrength: { value: 0.9 } }
    });
    this.halo = new Mesh(buildHaloGeometry(), this.haloMaterial);
    this.halo.renderOrder = 2;
  }

  setTheme(theme: MapTheme): void {
    this.domeMaterial.uniforms.spaceColor.value.set(theme.space);
    this.domeMaterial.uniforms.nebulaColor.value.set(theme.nebula);
    this.domeMaterial.uniforms.starBrightness.value = theme.starBrightness;
    this.haloMaterial.uniforms.haloColor.value.set(theme.halo);
  }

  /** The dome keeps the camera at its centre so stars never parallax. */
  follow(camera: Camera): void {
    this.dome.position.copy(camera.position);
  }
}

import { cloudFieldChunk, cloudShadowChunk, fogChunk, noiseChunk, skyChunk, weatherChunk } from './glsl-common';
import { MAX_DEPTH_METRES } from './layout';
import { waveGlsl } from './sea-waves';

export const seaVertex = /* glsl */ `
  attribute float edge;
  varying vec3 vWorld;
  varying vec3 vBaseNormal;
  varying float vDepth;
  varying float vEdge;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vBaseNormal = normalize(mat3(modelMatrix) * normal);
    vEdge = edge;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

/**
 * Ocean: a sum of deep-water Gerstner waves shaded per pixel from analytic derivatives, each wave faded out at its own
 * pixel footprint (no far-field moire). Fresnel sky reflection, sun glitter, light scattered through crests, Jacobian
 * foam, shore surf and bathymetric colour. Wave energy follows the forecast wind speed; the swell direction follows the
 * mean wind (a single direction keeps the phase field coherent). It is wind-derived, not measured wave data.
 */
export function seaFragment(): string {
  return /* glsl */ `
  uniform vec2 windDirection;
  uniform vec2 flowOffset;
  uniform sampler2D landMask;
  uniform sampler2D bathymetry;
  uniform sampler2D coastField;
  uniform vec3 shallowColor;
  uniform vec3 midColor;
  uniform vec3 deepColor;
  uniform vec3 scatterColor;
  uniform vec3 foamColor;
  uniform vec3 haloColor;
  uniform float flash;
  uniform float reveal;
  varying vec3 vWorld;
  varying vec3 vBaseNormal;
  varying float vDepth;
  varying float vEdge;
  ${noiseChunk}
  ${weatherChunk}
  ${fogChunk}
  ${skyChunk}
  ${cloudFieldChunk}
  ${cloudShadowChunk}
  ${waveGlsl()}
  void main() {
    vec2 planeUv = (vWorld.xz + vec2(500.0, 250.0)) / vec2(1000.0, 500.0);
    bool insidePlane = planeUv.x >= 0.0 && planeUv.x <= 1.0 && planeUv.y >= 0.0 && planeUv.y <= 1.0;
    vec2 clampedUv = clamp(planeUv, 0.0, 1.0);

    // Bathymetry only exists inside the relief window; fade it into open ocean so its edge never shows.
    float windowFade = smoothstep(0.0, 0.12, planeUv.x) * smoothstep(0.0, 0.12, 1.0 - planeUv.x)
      * smoothstep(0.0, 0.24, planeUv.y) * smoothstep(0.0, 0.24, 1.0 - planeUv.y);
    float reliefDepth = pow(texture2D(bathymetry, clampedUv).r, 2.0) * ${MAX_DEPTH_METRES.toFixed(1)};
    float coastNear = texture2D(coastField, clampedUv).r;
    float coastal = smoothstep(0.004, 0.14, coastNear);
    // Broad shelves far from any coast read deeper and vary slowly, instead of one flat shallow slab.
    float basin = fbm3(vWorld.xz * 0.006);
    float shelfDepth = reliefDepth * mix(1.7, 1.0, coastal) * (0.8 + 0.4 * basin);
    float depthMetres = mix(6000.0, shelfDepth, windowFade);

    vec4 weather = weatherAt(clampedUv);
    float windSpeed = length(weather.xy);
    float rain = weather.a;
    float openWater = smoothstep(4.0, 90.0, depthMetres);
    float energy = clamp(0.3 + windSpeed / 34.0, 0.3, 1.0) * mix(0.4, 1.0, openWater);

    // Gerstner sum: slope terms for the normal, displacement terms for the Jacobian.
    float footprint = 2.0 * (fwidth(vWorld.x) + fwidth(vWorld.z));
    float height = 0.0;
    float slopeX = 0.0;
    float slopeZ = 0.0;
    float sxx = 0.0;
    float szz = 0.0;
    float sxz = 0.0;
    for (int index = 0; index < WAVE_COUNT; index++) {
      vec3 wave = WAVES[index];
      float turn = cos(wave.x);
      float spin = sin(wave.x);
      vec2 direction = vec2(windDirection.x * turn - windDirection.y * spin, windDirection.x * spin + windDirection.y * turn);
      float wavelength = wave.y;
      float wavenumber = 6.2831853 / wavelength;
      float fade = 1.0 - smoothstep(0.18 * wavelength, 0.5 * wavelength, footprint);
      float steepness = wave.z * energy * fade;
      float phase = wavenumber * dot(direction, vWorld.xz) - wavePhase[index];
      float sine = sin(phase);
      float cosine = cos(phase);
      height += steepness / wavenumber * sine;
      slopeX += steepness * direction.x * cosine;
      slopeZ += steepness * direction.y * cosine;
      sxx -= steepness * direction.x * direction.x * sine;
      szz -= steepness * direction.y * direction.y * sine;
      sxz -= steepness * direction.x * direction.y * sine;
    }
    vec3 tangentX = vec3(1.0 + sxx, slopeX, sxz);
    vec3 tangentZ = vec3(sxz, slopeZ, 1.0 + szz);
    vec3 waveNormal = normalize(cross(tangentZ, tangentX));
    float jacobian = (1.0 + sxx) * (1.0 + szz) - sxz * sxz;

    // Capillary chop travelling with the wind; only resolved when the camera is close.
    float rippleFade = 1.0 - smoothstep(0.4, 1.6, footprint);
    vec2 ripplePoint = vWorld.xz * 0.9 - flowOffset;
    float rippleBase = fbm3(ripplePoint);
    vec2 rippleGradient = vec2(fbm3(ripplePoint + vec2(0.15, 0.0)) - rippleBase, fbm3(ripplePoint + vec2(0.0, 0.15)) - rippleBase) / 0.15;
    waveNormal.xz -= rippleGradient * 0.12 * (0.6 + energy + rain * 2.0) * rippleFade;
    waveNormal = normalize(waveNormal);

    vec3 baseNormal = normalize(vBaseNormal);
    vec3 normal = normalize(baseNormal + (waveNormal - vec3(0.0, 1.0, 0.0)));
    vec3 viewDirection = normalize(cameraPosition - vWorld);
    vec3 sunDir = normalize(sunDirection);
    float daylight = clamp(dot(sunColor, vec3(0.3333)) * 0.9, 0.22, 1.0);
    float cloudShade = cloudShadowAt(vWorld);
    float sunVisibility = (1.0 - 0.75 * cloudShade) * (1.0 - 0.5 * rain);

    // Body colour: turquoise over shallows to navy offshore, with light scattered through sun-facing crests.
    float absorption = 1.0 - exp(-depthMetres / 40.0);
    vec3 body = mix(shallowColor, midColor, smoothstep(0.0, 0.85, absorption));
    body = mix(body, deepColor, smoothstep(150.0, 3500.0, depthMetres));
    vec2 lookDirection = normalize(-viewDirection.xz + vec2(1e-4));
    vec2 sunHorizontal = normalize(sunDir.xz + vec2(1e-4));
    float towardSun = pow(max(dot(lookDirection, sunHorizontal), 0.0), 2.0);
    float crestHeight = clamp(0.5 + height / AMPLITUDE_SUM * 1.4, 0.0, 1.0);
    float scatter = towardSun * crestHeight * (0.35 + 4.0 * (1.0 - waveNormal.y)) * energy;
    body += scatterColor * sunColor * scatter * 0.9 * sunVisibility;
    body *= mix(0.7, 1.0, max(dot(normal, sunDir), 0.0));
    body *= (1.0 - 0.28 * cloudShade) * (1.0 - 0.18 * rain) * daylight;

    // Fresnel reflection of the sky plus sun glitter.
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    vec3 reflection = reflect(-viewDirection, normal);
    reflection.y = abs(reflection.y) + 0.002;
    reflection = normalize(reflection);
    float alignment = max(dot(reflection, sunDir), 0.0);
    float glitter = pow(alignment, 90.0) * 0.6 + pow(alignment, 12.0) * 0.03 + pow(alignment, 1400.0) * 40.0;
    vec3 color = mix(body, skyGradient(reflection), fresnel);
    color += sunColor * glitter * sunVisibility * 0.8;

    // Foam: wave crests where the surface compresses, plus surf along the shore.
    float detailVisibility = 1.0 - smoothstep(1.0, 3.5, footprint);
    float foamThreshold = mix(0.25, 0.8, smoothstep(8.0, 42.0, windSpeed)) * energy;
    float crestFoam = 1.0 - smoothstep(foamThreshold - 0.25, foamThreshold, jacobian);
    float lace = smoothstep(0.35, 0.75, fbm3(vWorld.xz * 1.7 - flowOffset * 0.7));
    crestFoam *= mix(0.9, lace, detailVisibility);
    float shoreMask = 0.0;
    if (insidePlane) shoreMask = texture2D(landMask, planeUv).r;
    float swash = 0.5 + 0.5 * sin(wavePhase[2] - shoreMask * 26.0);
    float shoreBand = smoothstep(0.2 + 0.14 * swash, 0.6, shoreMask);
    float shoreLace = smoothstep(0.38, 0.66, fbm3(vWorld.xz * 2.2 + flowOffset * 0.3));
    float shoreFoam = shoreBand * mix(0.85, shoreLace * 1.2, detailVisibility);
    float reef = (1.0 - smoothstep(1.0, 14.0, depthMetres)) * coastal;
    color = mix(color, foamColor * mix(0.45, 1.0, daylight), clamp(shoreFoam * 0.9 + crestFoam * 0.8 + reef * 0.12, 0.0, 1.0));

    // Atmosphere: the sea glows at the rolled-over limb and fades into the halo colour.
    float rimView = pow(1.0 - max(dot(baseNormal, viewDirection), 0.0), 3.0);
    float rimMask = smoothstep(0.3, 1.0, vEdge);
    color = mix(color, haloColor, clamp(rimView * rimMask * 0.9, 0.0, 1.0));
    color = mix(color, haloColor * 1.2, smoothstep(0.93, 1.0, vEdge));
    color = applyFog(color, vDepth);
    color += vec3(0.85, 0.9, 1.0) * flash * 0.05;
    // Transition: water first appears along the coasts and spreads out to open sea as reveal grows.
    float farFromCoast = 1.0 - clamp(coastNear * 3.0, 0.0, 1.0);
    float tide = clamp(reveal * 2.2 - farFromCoast * 1.2, 0.0, 1.0) * smoothstep(0.0, 0.15, reveal);
    gl_FragColor = vec4(color, tide);
    #include <colorspace_fragment>
  }
`;
}

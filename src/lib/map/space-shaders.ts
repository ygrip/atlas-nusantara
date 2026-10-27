import { noiseChunk } from './glsl-common';

/** Space backdrop. The sphere follows the camera and is pinned to the far plane, so it only shades pixels no world geometry covers. */
export const spaceVertex = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww;
  }
`;

export const spaceFragment = /* glsl */ `
  uniform float time;
  uniform vec3 spaceColor;
  uniform vec3 nebulaColor;
  uniform float starBrightness;
  uniform vec3 paperColor;
  uniform float reveal;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  varying vec3 vDirection;
  ${noiseChunk}
  // One layer of stars: a jittered point per 3D cell, so stars do not pinch at the poles.
  vec3 starLayer(vec3 direction, float scale, float radius, float cutoff, float seed) {
    vec3 p = direction * scale;
    vec3 cell = floor(p);
    vec3 local = fract(p) - 0.5;
    float chance = hash31(cell + seed);
    if (chance < cutoff) return vec3(0.0);
    vec3 jitter = (vec3(hash31(cell + seed + 1.7), hash31(cell + seed + 5.3), hash31(cell + seed + 9.1)) - 0.5) * 0.5;
    float core = 1.0 - smoothstep(0.0, radius, length(local - jitter));
    float twinkle = 0.7 + 0.3 * sin(time * (1.2 + chance * 3.0) + chance * 60.0);
    float brightness = 0.45 + (chance - cutoff) / (1.0 - cutoff) * 0.9;
    vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.65, 0.78, 1.0), fract(chance * 13.7));
    return tint * core * core * twinkle * brightness;
  }
  void main() {
    vec3 direction = normalize(vDirection);
    vec3 color = spaceColor;
    // A faint galactic band with dust lanes.
    vec3 bandAxis = normalize(vec3(0.8, 0.25, 0.0));
    float bandOffset = dot(direction, bandAxis);
    float band = exp(-bandOffset * bandOffset * 8.0);
    float clouds = valueNoise3(direction * 5.0) * 0.6 + valueNoise3(direction * 13.0) * 0.4;
    float lanes = smoothstep(0.35, 0.75, valueNoise3(direction * 9.0 + 3.0));
    color += nebulaColor * band * (0.4 + clouds) * (1.0 - 0.5 * lanes) * 1.4;
    color += vec3(0.9, 0.86, 1.0) * pow(band, 3.0) * clouds * 0.1;
    vec3 stars = starLayer(direction, 34.0, 0.11, 0.55, 0.0) * 1.6
      + starLayer(direction, 80.0, 0.08, 0.5, 11.0)
      + starLayer(direction, 170.0, 0.06, 0.45, 23.0) * 0.7;
    color += stars * (1.0 + band * 1.2) * starBrightness;
    float towardSun = max(dot(direction, normalize(sunDirection)), 0.0);
    color += sunColor * (pow(towardSun, 5.0) * 0.06 + pow(towardSun, 60.0) * 0.3 + smoothstep(0.9993, 0.9998, towardSun) * 1.6);
    gl_FragColor = vec4(mix(paperColor, color, reveal), 1.0);
    #include <colorspace_fragment>
  }
`;

/** Additive ring of atmosphere around the limb; glow is 0 at both edges of the ring. */
export const haloVertex = /* glsl */ `
  attribute float glow;
  varying float vGlow;
  varying vec3 vWorld;
  void main() {
    vGlow = glow;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const haloFragment = /* glsl */ `
  uniform float time;
  uniform vec3 haloColor;
  uniform float haloStrength;
  varying float vGlow;
  varying vec3 vWorld;
  ${noiseChunk}
  void main() {
    // Slow, low-contrast shimmer so the atmosphere is not a perfectly smooth band.
    float shimmer = 0.85 + 0.15 * valueNoise(vWorld.xz * 0.012 + vec2(time * 0.02, 0.0));
    float glow = vGlow * shimmer;
    gl_FragColor = vec4(haloColor * haloStrength, glow);
    #include <colorspace_fragment>
  }
`;

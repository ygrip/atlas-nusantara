// GLSL chunks shared by the 3D atlas shaders. Plane coordinates: x 0..1000 east, y 0..500 south (SVG);
// world X = x − 500, world Z = y − 250, world Y is up. Colours reaching shaders are linear; output is converted once.

import { CLOUD_BASE_HEIGHT, CLOUD_TOP_HEIGHT } from './layout';

export const noiseChunk = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float valueNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float sum = 0.0; float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) { sum += amplitude * valueNoise(p); p = p * 2.03 + vec2(17.1, 9.2); amplitude *= 0.5; }
    return sum;
  }
  float fbm3(vec2 p) {
    float sum = 0.0; float amplitude = 0.5;
    for (int octave = 0; octave < 3; octave++) { sum += amplitude * valueNoise(p); p = p * 2.03 + vec2(17.1, 9.2); amplitude *= 0.5; }
    return sum / 0.875;
  }
  float hash31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float valueNoise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float x00 = mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), u.x);
    float x10 = mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x);
    float x01 = mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x);
    float x11 = mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x);
    return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
  }
`;

/** Forecast fields: wind ±60 km/h in rg, cloud cover in b, rain intensity in a. */
export const weatherChunk = /* glsl */ `
  uniform sampler2D weatherA;
  uniform sampler2D weatherB;
  uniform float weatherMix;
  vec4 weatherAt(vec2 planeUv) {
    vec4 value = mix(texture2D(weatherA, planeUv), texture2D(weatherB, planeUv), weatherMix);
    return vec4((value.rg * 255.0 - 128.0) * (120.0 / 255.0), value.b, value.a);
  }
  // Fades fields toward the frame edge so no layer ends in a hard border.
  float planeEdgeFade(vec2 planeUv, float width) {
    vec2 inner = smoothstep(vec2(0.0), vec2(width, width * 2.0), planeUv) * smoothstep(vec2(0.0), vec2(width, width * 2.0), vec2(1.0) - planeUv);
    return inner.x * inner.y;
  }
`;

export const fogChunk = /* glsl */ `
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  vec3 applyFog(vec3 color, float depth) { return mix(color, fogColor, smoothstep(fogNear, fogFar, depth)); }
`;

/** Sun, sky gradient and the sun glow reflected by water. */
export const skyChunk = /* glsl */ `
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform vec3 skyZenith;
  uniform vec3 skyHorizon;
  vec3 skyGradient(vec3 direction) {
    float height = clamp(direction.y, 0.0, 1.0);
    vec3 sky = mix(skyHorizon, skyZenith, pow(height, 0.5));
    float towardSun = max(dot(direction, normalize(sunDirection)), 0.0);
    return sky + sunColor * pow(towardSun, 6.0) * 0.08;
  }
`;

/**
 * Cloud shape shared by the cloud volume and by the shadows clouds cast on land and sea.
 * cloudDrift is the pattern offset in noise units; weather cover/rain decide where clouds form.
 */
export const cloudFieldChunk = /* glsl */ `
  uniform vec2 cloudDrift;
  uniform float cloudStrength;
  const float CLOUD_BASE = ${CLOUD_BASE_HEIGHT.toFixed(1)};
  const float CLOUD_TOP = ${CLOUD_TOP_HEIGHT.toFixed(1)};
  float cloudBillows(vec2 xz) {
    vec2 p = xz * 0.011 - cloudDrift;
    float large = fbm3(p);
    float detail = valueNoise(p * 4.3 + 7.7);
    return large * 0.8 + detail * 0.2;
  }
  // heightFraction: 0 at the cloud base, 1 at the top. Cover widens the cloud; storms grow taller and keep their tops.
  float cloudDensityAt(vec2 xz, float heightFraction, float cover, float storm) {
    float shape = cloudBillows(xz);
    float threshold = 1.0 - cover * 0.92;
    float cumulusBias = 0.22 - 0.5 * heightFraction;
    float stormBias = 0.34 - 0.16 * heightFraction;
    float bias = mix(cumulusBias, stormBias, storm);
    float profile = smoothstep(0.0, 0.1, heightFraction) * (1.0 - smoothstep(0.86, 1.0, heightFraction));
    return clamp((shape - threshold + bias) * 3.2, 0.0, 1.0) * profile;
  }
`;

/** Darkening of the ground by clouds, found by tracing the sun ray up to the cloud slab. */
export const cloudShadowChunk = /* glsl */ `
  float cloudShadowAt(vec3 worldPosition) {
    if (cloudStrength < 0.01) return 0.0;
    vec3 toSun = normalize(sunDirection);
    float distanceToSlab = (CLOUD_BASE + 8.0 - worldPosition.y) / max(toSun.y, 0.25);
    vec2 xz = worldPosition.xz + toSun.xz * distanceToSlab;
    vec2 planeUv = (xz + vec2(500.0, 250.0)) / vec2(1000.0, 500.0);
    if (planeUv.x < 0.0 || planeUv.x > 1.0 || planeUv.y < 0.0 || planeUv.y > 1.0) return 0.0;
    vec4 weather = weatherAt(planeUv);
    float cover = clamp(weather.b + weather.a * 0.3, 0.0, 1.0) * planeEdgeFade(planeUv, 0.03);
    float storm = smoothstep(0.2, 0.8, weather.a);
    return clamp(cloudDensityAt(xz, 0.35, cover, storm) * 1.8, 0.0, 1.0) * cloudStrength;
  }
`;

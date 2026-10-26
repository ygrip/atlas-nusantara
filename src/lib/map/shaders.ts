// GLSL for wind/rain streaks and overlay pins. Terrain, sea, cloud and space shaders live in their own modules:
// terrain-shaders.ts, sea-shaders.ts, cloud-shaders.ts, space-shaders.ts (shared chunks in glsl-common.ts).

export const streakVertex = /* glsl */ `
  attribute float alpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = alpha;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const streakFragment = /* glsl */ `
  uniform float opacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * opacity);
  }
`;

/** Overlay pins: per-pin colour and symbol (0 circle, 1 triangle, 2 diamond) with a soft pulsing halo. */
export const pinVertex = /* glsl */ `
  attribute float size;
  attribute vec3 pinColor;
  attribute float symbolIndex;
  attribute float phase;
  uniform float pixelRatio;
  varying vec3 vColor;
  varying float vSymbol;
  varying float vPhase;
  void main() {
    vColor = pinColor;
    vSymbol = symbolIndex;
    vPhase = phase;
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const pinFragment = /* glsl */ `
  uniform float time;
  varying vec3 vColor;
  varying float vSymbol;
  varying float vPhase;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float radius = length(p);
    // The symbol fills the middle of the sprite; the rest of the sprite is room for the halo.
    vec2 q = p / 0.54;
    float shape = length(q);
    if (vSymbol > 0.5 && vSymbol < 1.5) shape = max(abs(q.x) * 1.73 + q.y, -q.y * 2.0) * 0.5;
    if (vSymbol >= 1.5) shape = (abs(q.x) + abs(q.y)) * 0.75;
    float core = 1.0 - smoothstep(0.44, 0.48, shape);
    float rimLight = smoothstep(0.3, 0.36, shape);
    vec3 body = mix(vColor, vec3(1.0, 0.94, 0.8), rimLight);
    float pulse = fract(time * 0.45 + vPhase);
    float ringRadius = mix(0.27, 0.5, pulse);
    float ring = (1.0 - smoothstep(0.0, 0.045, abs(radius - ringRadius))) * (1.0 - pulse) * 0.8;
    float glow = (1.0 - smoothstep(0.1, 0.5, radius)) * 0.18;
    float alpha = core * 0.97 + (1.0 - core) * max(ring, glow);
    if (alpha < 0.01 || radius > 0.5) discard;
    gl_FragColor = vec4(mix(vColor, body, core), alpha);
    #include <colorspace_fragment>
  }
`;

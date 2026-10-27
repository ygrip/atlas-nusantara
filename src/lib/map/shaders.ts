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

/** Overlay pins: a clay marker sampled from the SVG atlas, with a soft pulsing halo in the pin colour behind it. */
export const pinVertex = /* glsl */ `
  attribute float size;
  attribute vec3 pinColor;
  attribute float cell;
  attribute float phase;
  uniform float pixelRatio;
  uniform float viewportHeight;
  varying vec3 vColor;
  varying float vCell;
  varying float vPhase;
  // The clay marker's contact shadow sits this far below the sprite centre (fraction of the sprite size).
  const float CONTACT_OFFSET = 0.262;
  void main() {
    vColor = pinColor;
    vCell = cell;
    vPhase = phase;
    gl_PointSize = size * pixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Lift the sprite so its contact shadow, not its middle, marks the real location on the ground.
    gl_Position.y += CONTACT_OFFSET * gl_PointSize * 2.0 / viewportHeight * gl_Position.w;
  }
`;

export const pinFragment = /* glsl */ `
  uniform float time;
  uniform sampler2D atlas;
  uniform vec2 atlasGrid;
  varying vec3 vColor;
  varying float vCell;
  varying float vPhase;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float radius = length(p);
    if (radius > 0.5) discard;
    // The marker occupies the middle 80% of the sprite; the rest is room for the halo.
    vec4 clay = vec4(0.0);
    if (abs(p.x) < 0.4 && abs(p.y) < 0.4) {
      vec2 local = p / 0.8 + vec2(0.5);
      float column = mod(vCell, atlasGrid.x);
      float row = floor(vCell / atlasGrid.x);
      vec2 uv = vec2((column + local.x) / atlasGrid.x, 1.0 - (row + local.y) / atlasGrid.y);
      clay = texture2D(atlas, uv);
    }
    float pulse = fract(time * 0.45 + vPhase);
    float ringRadius = mix(0.3, 0.5, pulse);
    float ring = (1.0 - smoothstep(0.0, 0.045, abs(radius - ringRadius))) * (1.0 - pulse) * 0.8;
    float glow = (1.0 - smoothstep(0.1, 0.5, radius)) * 0.18;
    float halo = max(ring, glow);
    float alpha = clay.a + (1.0 - clay.a) * halo;
    if (alpha < 0.01) discard;
    vec3 color = (clay.rgb * clay.a + vColor * (1.0 - clay.a) * halo) / alpha;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

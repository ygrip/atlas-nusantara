// GLSL for the 3D atlas. Plane coordinates: x 0..1000 east, y 0..500 south (SVG), world X = x − 500, Z = y − 250.

const noise = /* glsl */ `
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
`;

const weatherSample = /* glsl */ `
  uniform sampler2D weatherA;
  uniform sampler2D weatherB;
  uniform float weatherMix;
  vec4 weatherAt(vec2 planeUv) {
    vec4 value = mix(texture2D(weatherA, planeUv), texture2D(weatherB, planeUv), weatherMix);
    // Unpack: wind ±60 km/h in rg, cloud cover in b, rain intensity in a.
    return vec4((value.rg * 255.0 - 128.0) * (120.0 / 255.0), value.b, value.a);
  }
`;

const fog = /* glsl */ `
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  vec3 applyFog(vec3 color, float depth) { return mix(color, fogColor, smoothstep(fogNear, fogFar, depth)); }
`;

export const terrainVertex = /* glsl */ `
  attribute float elevation;
  attribute float land;
  varying vec2 vPlane;
  varying vec3 vNormal;
  varying float vElevation;
  varying float vLand;
  varying float vDepth;
  varying vec3 vWorld;
  void main() {
    vPlane = vec2(position.x + 500.0, position.z + 250.0);
    vNormal = normalize(normal);
    vElevation = elevation;
    vLand = land;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

export const terrainFragment = /* glsl */ `
  uniform sampler2D regionIds;
  uniform sampler2D detailIds;
  uniform vec4 detailBounds;
  uniform sampler2D palette;
  uniform vec3 sunDirection;
  uniform vec3 skyLight;
  uniform vec3 groundLight;
  uniform vec3 coastColor;
  uniform float contourStrength;
  uniform float flash;
  varying vec2 vPlane;
  varying vec3 vNormal;
  varying float vElevation;
  varying float vLand;
  varying float vDepth;
  varying vec3 vWorld;
  ${fog}
  float contourLine(float value, float interval, float width) {
    float scaled = value / interval;
    float distanceToLine = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), 1e-4);
    return 1.0 - clamp(distanceToLine / width, 0.0, 1.0);
  }
  void main() {
    vec2 uv = vPlane / vec2(1000.0, 500.0);
    float id = floor(texture2D(regionIds, uv).r * 255.0 + 0.5);
    vec2 detailUv = (vPlane - detailBounds.xy) / detailBounds.zw;
    if (detailUv.x >= 0.0 && detailUv.x <= 1.0 && detailUv.y >= 0.0 && detailUv.y <= 1.0) {
      float cityId = floor(texture2D(detailIds, detailUv).r * 255.0 + 0.5);
      if (cityId > 0.5) id = cityId;
    }
    vec4 region = texture2D(palette, vec2((id + 0.5) / 256.0, 0.5));
    vec3 base = region.rgb;
    if (id < 0.5) base = coastColor;
    // Hypsometric warmth: highlands drift toward baked clay, coasts toward sand.
    float highland = smoothstep(1200.0, 4200.0, vElevation);
    base = mix(base, base * vec3(0.86, 0.78, 0.7) + vec3(0.08, 0.05, 0.03), highland * 0.55);
    base = mix(coastColor, base, smoothstep(0.35, 0.75, vLand));
    vec3 normal = normalize(vNormal);
    float diffuse = max(dot(normal, normalize(sunDirection)), 0.0);
    vec3 ambient = mix(groundLight, skyLight, normal.y * 0.5 + 0.5);
    vec3 color = base * (ambient * 0.62 + diffuse * 0.58);
    if (vLand > 0.5 && vElevation > 25.0) {
      float minor = contourLine(vElevation, 250.0, 0.9);
      float major = contourLine(vElevation, 1000.0, 1.4);
      color *= 1.0 - contourStrength * (minor * 0.12 + major * 0.2);
    }
    color += vec3(0.9, 0.92, 1.0) * flash * 0.08;
    gl_FragColor = vec4(applyFog(color, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

export const seaVertex = /* glsl */ `
  varying vec2 vPlane;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPlane = vec2(world.x + 500.0, world.z + 250.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

export const seaFragment = /* glsl */ `
  uniform float time;
  uniform sampler2D landMask;
  uniform sampler2D bathymetry;
  uniform vec3 sunDirection;
  uniform vec3 shallowColor;
  uniform vec3 midColor;
  uniform vec3 deepColor;
  uniform vec3 skyColor;
  uniform vec3 foamColor;
  uniform float flash;
  varying vec2 vPlane;
  varying vec3 vWorld;
  varying float vDepth;
  ${noise}
  ${weatherSample}
  ${fog}
  vec2 rotate(vec2 v, float angle) { float s = sin(angle); float c = cos(angle); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
  // Per-pixel Gerstner swell: accumulates the surface slope and crest height of one wave train.
  void gerstner(vec2 position, vec2 direction, float wavelength, float amplitude, inout vec2 slope, inout float height) {
    float k = 6.28318 / wavelength;
    float speed = sqrt(9.8 / k) * 0.9;
    float phase = k * (dot(direction, position) - speed * time);
    height += amplitude * sin(phase);
    slope += direction * k * amplitude * cos(phase);
  }
  void main() {
    vec2 uv = vPlane / vec2(1000.0, 500.0);
    bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
    vec2 clampedUv = clamp(uv, 0.0, 1.0);
    // Fade the finite relief window into deep ocean; never stretch its edge pixels into stripes.
    float reliefEdge = smoothstep(0.0, 0.08, uv.x) * smoothstep(0.0, 0.08, 1.0 - uv.x)
      * smoothstep(0.0, 0.1, uv.y) * smoothstep(0.0, 0.1, 1.0 - uv.y);
    float depthSample = mix(0.85, texture2D(bathymetry, clampedUv).r, reliefEdge);
    float depthMetres = depthSample * depthSample * 9000.0;
    float land = 0.0;
    if (inside) land = texture2D(landMask, uv).r;
    vec4 weather = weatherAt(clampedUv);
    float windSpeed = length(weather.xy);
    vec2 direction = weather.xy / max(windSpeed, 0.1);
    if (windSpeed <= 0.1) direction = vec2(1.0, 0.0);
    // Wind sea grows with wind speed and with open water; it calms in sheltered shallows.
    float energy = clamp(windSpeed / 35.0, 0.1, 1.0) * (1.0 - smoothstep(0.1, 0.55, land)) * mix(0.55, 1.0, smoothstep(5.0, 60.0, depthMetres));
    vec2 slope = vec2(0.0);
    float height = 0.0;
    gerstner(vWorld.xz, direction, 16.0, 0.26 * energy, slope, height);
    gerstner(vWorld.xz, normalize(rotate(direction, 0.5)), 8.5, 0.13 * energy, slope, height);
    gerstner(vWorld.xz, normalize(rotate(direction, -0.65)), 5.0, 0.07 * energy, slope, height);
    gerstner(vWorld.xz, normalize(rotate(direction, 0.2)), 2.6, 0.03 * energy, slope, height);
    float crest = height / max(0.49 * energy, 0.01);
    // Capillary ripples travel with the wind on top of the swell.
    vec2 flow = direction * time * (0.8 + windSpeed * 0.06);
    vec2 ripplePoint = vWorld.xz * 1.1 - flow;
    float eps = 0.12;
    float r0 = fbm(ripplePoint);
    vec2 ripple = vec2(fbm(ripplePoint + vec2(eps, 0.0)) - r0, fbm(ripplePoint + vec2(0.0, eps)) - r0) * (0.5 + windSpeed * 0.025);
    vec3 normal = normalize(vec3(-slope.x - ripple.x * 2.0, 1.0, -slope.y - ripple.y * 2.0));
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 sun = normalize(sunDirection);
    float shelf = smoothstep(0.0, 120.0, depthMetres);
    float abyss = smoothstep(150.0, 4500.0, depthMetres);
    vec3 water = mix(mix(shallowColor, midColor, shelf), deepColor, abyss);
    // Light scattered back through thin crests looks greener.
    water += vec3(0.02, 0.07, 0.05) * clamp(crest, 0.0, 1.0) * energy;
    float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(normal, view), 0.0), 5.0);
    vec3 color = mix(water, skyColor, fresnel * 0.6);
    float specular = pow(max(dot(reflect(-sun, normal), view), 0.0), 220.0);
    color += vec3(1.0, 0.96, 0.88) * specular * 0.4;
    // Surf: a breaking band along the coast whose rhythm follows the swell.
    float coast = smoothstep(0.03, 0.3, land) * (1.0 - smoothstep(0.32, 0.5, land));
    float surf = coast * smoothstep(0.42, 0.72, fbm(vWorld.xz * 1.8 + flow * 0.5) + 0.22 * sin(time * 1.3 - land * 28.0));
    // Whitecaps appear on crests from ~20 km/h (Beaufort 4) upward.
    float detailFade = 1.0 - smoothstep(0.7, 2.5, length(fwidth(vWorld.xz)));
    float whitecap = smoothstep(18.0, 40.0, windSpeed) * smoothstep(0.5, 1.0, crest) * smoothstep(0.55, 0.78, fbm(vWorld.xz * 2.6 - flow * 1.5)) * detailFade;
    color = mix(color, foamColor, clamp(surf * 0.85 + whitecap * 0.7, 0.0, 1.0));
    float bathyLine = abs(fract(depthMetres / 1000.0 - 0.5) - 0.5) / max(fwidth(depthMetres / 1000.0), 1e-4);
    color *= 1.0 - 0.07 * (1.0 - clamp(bathyLine, 0.0, 1.0)) * step(150.0, depthMetres);
    color += vec3(0.85, 0.9, 1.0) * flash * 0.05;
    gl_FragColor = vec4(applyFog(color, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

export const cloudVertex = /* glsl */ `
  varying vec2 vPlane;
  varying float vDepth;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPlane = vec2(world.x + 500.0, world.z + 250.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

export const cloudFragment = /* glsl */ `
  uniform float time;
  uniform vec2 drift;
  uniform float scale;
  uniform float opacity;
  uniform float seed;
  uniform vec3 sunDirection;
  uniform vec3 litColor;
  uniform vec3 shadeColor;
  uniform vec3 stormColor;
  uniform vec3 flashPosition;
  uniform float flash;
  varying vec2 vPlane;
  varying float vDepth;
  varying vec3 vWorld;
  ${noise}
  ${weatherSample}
  ${fog}
  void main() {
    vec2 uv = vPlane / vec2(1000.0, 500.0);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
    vec4 weather = weatherAt(uv);
    float cover = weather.b;
    vec2 point = vPlane * scale - drift + seed;
    float density = fbm(point + 0.35 * vec2(fbm(point * 0.5 + time * 0.01), fbm(point * 0.5 - time * 0.012)));
    float threshold = 1.0 - cover * 0.9;
    float alpha = smoothstep(threshold - 0.02, threshold + 0.22, density) * opacity;
    if (alpha < 0.01) discard;
    // Self-shadowing: denser toward the sun means a darker underside.
    vec2 toSun = normalize(sunDirection.xz) * 0.6;
    float shadow = clamp((fbm(point + toSun) - density) * 3.0 + 0.6, 0.0, 1.0);
    vec3 color = mix(shadeColor, litColor, shadow);
    color = mix(color, stormColor, smoothstep(0.25, 0.85, weather.a));
    float lightning = flash * exp(-distance(vWorld.xz, flashPosition.xz) / 40.0);
    color += vec3(0.95, 0.95, 1.0) * lightning * 1.6;
    // Fade near the frame edge so the layer has no hard border.
    float edge = smoothstep(0.0, 0.03, uv.x) * smoothstep(0.0, 0.03, 1.0 - uv.x) * smoothstep(0.0, 0.05, uv.y) * smoothstep(0.0, 0.05, 1.0 - uv.y);
    gl_FragColor = vec4(applyFog(color, vDepth), alpha * edge);
    #include <colorspace_fragment>
  }
`;

// A shallow cloud-deck veil appears only while the camera passes through the visual cloud layer.
// Coverage comes from the snapshot; cloud altitude is a presentation convention, not a measured height.
export const cloudVeilVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const cloudVeilFragment = /* glsl */ `
  uniform float time;
  uniform float density;
  uniform vec3 color;
  varying vec2 vUv;
  ${noise}
  void main() {
    float wisps = fbm(vUv * vec2(7.0, 5.0) + vec2(time * 0.03, -time * 0.02));
    float alpha = density * smoothstep(0.15, 0.65, wisps);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

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

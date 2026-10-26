import { cloudFieldChunk, fogChunk, noiseChunk, skyChunk, weatherChunk } from './glsl-common';

export const cloudVolumeVertex = /* glsl */ `
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

/**
 * Volumetric-looking cloud deck. A plane at mid-height is only the screen footprint: every pixel marches the camera ray
 * through a slab, sampling a density that is shaped by forecast cloud cover (wide, low-topped cumulus) and rain
 * (tall, dark storm towers). Light is estimated by one density sample toward the sun, so sun-facing tops glow and bases are grey.
 */
export const cloudVolumeFragment = /* glsl */ `
  uniform vec3 litColor;
  uniform vec3 shadeColor;
  uniform vec3 stormColor;
  uniform float marchSteps;
  uniform float flash;
  uniform vec3 flashPosition;
  varying vec3 vWorld;
  varying float vDepth;
  ${noiseChunk}
  ${weatherChunk}
  ${fogChunk}
  ${skyChunk}
  ${cloudFieldChunk}
  const int MAX_MARCH_STEPS = 12;
  // Slightly reduced cover plus a steeper ramp: cumulus get defined edges and clear gaps instead of a milky haze. Storm towers stay dense.
  float definedDensityAt(vec2 xz, float heightFraction, float cover, float storm) {
    float raw = cloudDensityAt(xz, heightFraction, cover * 0.88, storm);
    return smoothstep(0.06, 0.72, raw);
  }
  void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDirection = normalize(vWorld - cameraPosition);
    if (abs(rayDirection.y) < 0.0005 || cloudStrength < 0.01) discard;
    float baseDistance = (CLOUD_BASE - rayOrigin.y) / rayDirection.y;
    float topDistance = (CLOUD_TOP - rayOrigin.y) / rayDirection.y;
    float enter = max(min(baseDistance, topDistance), 0.0);
    float leave = max(baseDistance, topDistance);
    if (leave <= enter) discard;
    leave = min(leave, enter + 420.0);

    // Cheap rejection where the forecast has neither cloud nor rain under this pixel.
    vec2 footprintUv = clamp((vWorld.xz + vec2(500.0, 250.0)) / vec2(1000.0, 500.0), 0.0, 1.0);
    vec4 footprintWeather = weatherAt(footprintUv);
    if (footprintWeather.b + footprintWeather.a < 0.05) discard;

    float stepLength = (leave - enter) / marchSteps;
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 sunDir = normalize(sunDirection);
    float thickness = CLOUD_TOP - CLOUD_BASE;
    float transmittance = 1.0;
    vec3 accumulated = vec3(0.0);
    for (int marchIndex = 0; marchIndex < MAX_MARCH_STEPS; marchIndex++) {
      if (float(marchIndex) >= marchSteps) break;
      float travelled = enter + (float(marchIndex) + jitter) * stepLength;
      vec3 point = rayOrigin + rayDirection * travelled;
      float heightFraction = clamp((point.y - CLOUD_BASE) / thickness, 0.0, 1.0);
      vec2 planeUv = (point.xz + vec2(500.0, 250.0)) / vec2(1000.0, 500.0);
      float edge = planeEdgeFade(planeUv, 0.03);
      if (edge <= 0.0) continue;
      vec4 weather = weatherAt(clamp(planeUv, 0.0, 1.0));
      float cover = clamp(weather.b + weather.a * 0.3, 0.0, 1.0) * edge * cloudStrength;
      float storm = smoothstep(0.2, 0.8, weather.a);
      float density = definedDensityAt(point.xz, heightFraction, cover, storm);
      if (density < 0.01) continue;

      float lightHeight = clamp(heightFraction + sunDir.y * 6.0 / thickness, 0.0, 1.0);
      float lightDensity = definedDensityAt(point.xz + sunDir.xz * 6.0, lightHeight, cover, storm);
      float sunReach = exp(-lightDensity * 2.8);
      float lighting = clamp(sunReach * 0.85 + heightFraction * 0.3, 0.0, 1.0);
      vec3 cloudColor = mix(shadeColor, litColor, lighting);
      cloudColor = mix(cloudColor, stormColor, storm * (0.75 - 0.35 * heightFraction));
      cloudColor += litColor * pow(1.0 - density, 3.0) * sunReach * 0.12;
      float lightning = flash * exp(-distance(point.xz, flashPosition.xz) / 40.0);
      cloudColor += vec3(0.95, 0.95, 1.0) * lightning * 1.6 * (0.3 + storm);

      float extinction = 0.042 * (1.0 + storm * 1.6);
      float opacity = 1.0 - exp(-density * stepLength * extinction);
      accumulated += transmittance * opacity * cloudColor;
      transmittance *= 1.0 - opacity;
      if (transmittance < 0.03) break;
    }
    float alpha = 1.0 - transmittance;
    if (alpha < 0.012) discard;
    vec3 color = applyFog(accumulated / alpha, vDepth);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export const cirrusVertex = /* glsl */ `
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

/** Thin, high ice-crystal streaks stretched along the wind; they glow near the sun. */
export const cirrusFragment = /* glsl */ `
  uniform vec3 litColor;
  uniform vec2 windAxis;
  varying vec3 vWorld;
  varying float vDepth;
  ${noiseChunk}
  ${weatherChunk}
  ${fogChunk}
  ${skyChunk}
  ${cloudFieldChunk}
  void main() {
    vec2 planeUv = (vWorld.xz + vec2(500.0, 250.0)) / vec2(1000.0, 500.0);
    vec4 weather = weatherAt(clamp(planeUv, 0.0, 1.0));
    // The sheet is larger than the map, so fade by the real plane (not the clamped weather lookup) and by camera distance.
    float margin = planeEdgeFade(vec2(0.5) + (planeUv - vec2(0.5)) * 0.75, 0.25);
    float distanceFade = 1.0 - smoothstep(260.0, 820.0, vDepth);
    // Cirrus travels faster than the lower deck.
    vec2 shifted = vWorld.xz - cloudDrift / 0.011 * 1.6;
    vec2 along = windAxis;
    vec2 across = vec2(-windAxis.y, windAxis.x);
    // A moderate stretch and a domain warp keep the wisps irregular; a strong stretch reads as repeating stripe bands.
    vec2 warp = vec2(fbm3(shifted * 0.006 + 5.0), fbm3(shifted * 0.006 + 21.0)) - 0.5;
    vec2 streakPoint = vec2(dot(shifted, along) * 0.0045, dot(shifted, across) * 0.011) + warp * 1.6;
    float streaks = fbm3(streakPoint + vec2(3.1, 8.2));
    float breakup = fbm3(shifted * 0.004 + 11.0);
    float amount = smoothstep(0.52, 0.9, streaks) * smoothstep(0.35, 0.75, breakup);
    float alpha = amount * 0.5 * weather.b * margin * distanceFade * cloudStrength * 0.4;
    if (alpha < 0.01) discard;
    vec3 sunDir = normalize(sunDirection);
    vec3 toPixel = normalize(vWorld - cameraPosition);
    float glow = pow(max(dot(-toPixel, sunDir), 0.0), 4.0);
    vec3 color = litColor * (0.85 + 0.3 * glow);
    gl_FragColor = vec4(applyFog(color, vDepth), alpha);
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
  ${noiseChunk}
  void main() {
    float wisps = fbm(vUv * vec2(7.0, 5.0) + vec2(time * 0.03, -time * 0.02));
    float alpha = density * 0.7 * smoothstep(0.2, 0.7, wisps);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

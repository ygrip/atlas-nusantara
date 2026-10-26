import { cloudFieldChunk, cloudShadowChunk, fogChunk, noiseChunk, skyChunk, weatherChunk } from './glsl-common';

export const terrainVertex = /* glsl */ `
  attribute float elevation;
  attribute float land;
  varying vec2 vPlane;
  varying float vElevation;
  varying float vLand;
  varying float vDepth;
  varying vec3 vWorld;
  void main() {
    vPlane = vec2(position.x + 500.0, position.z + 250.0);
    vElevation = elevation;
    vLand = land;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

/**
 * Land: hillshade from a normal map baked from real elevation (ETOPO1), hypsometric tint, slope rock, valley occlusion,
 * beaches, cloud shadows, rain wetness and anti-aliased elevation contours (every 100 m, every fifth a bold index line).
 * Island-group tint stays subtle; the selected or hovered region is raised toward its highlight colour.
 */
export const terrainFragment = /* glsl */ `
  uniform sampler2D regionIds;
  uniform sampler2D detailIds;
  uniform vec4 detailBounds;
  uniform sampler2D palette;
  uniform sampler2D reliefDetail;
  uniform vec3 skyLight;
  uniform vec3 groundLight;
  uniform vec3 sandColor;
  uniform float contourStrength;
  uniform float flash;
  varying vec2 vPlane;
  varying float vElevation;
  varying float vLand;
  varying float vDepth;
  varying vec3 vWorld;
  ${noiseChunk}
  ${weatherChunk}
  ${fogChunk}
  ${skyChunk}
  ${cloudFieldChunk}
  ${cloudShadowChunk}

  vec3 srgb(vec3 color) { return pow(color, vec3(2.2)); }

  // Lowland green to montane forest, brown highlands, bare rock and the ice cap of Puncak Jaya.
  vec3 hypsometricColor(float metres) {
    vec3 color = srgb(vec3(0.36, 0.57, 0.31));
    color = mix(color, srgb(vec3(0.43, 0.60, 0.32)), smoothstep(40.0, 350.0, metres));
    color = mix(color, srgb(vec3(0.28, 0.46, 0.27)), smoothstep(500.0, 1200.0, metres));
    color = mix(color, srgb(vec3(0.50, 0.47, 0.33)), smoothstep(1300.0, 2100.0, metres));
    color = mix(color, srgb(vec3(0.52, 0.46, 0.40)), smoothstep(2100.0, 3000.0, metres));
    color = mix(color, srgb(vec3(0.58, 0.56, 0.54)), smoothstep(3000.0, 3800.0, metres));
    color = mix(color, srgb(vec3(0.96, 0.97, 0.98)), smoothstep(3900.0, 4250.0, metres));
    return color;
  }

  // One thin anti-aliased line per integer of "scaled"; hidden when lines would be closer than a few pixels.
  float contourLine(float scaled) {
    float pixelStep = max(fwidth(scaled), 1e-4);
    float distanceToLine = abs(fract(scaled - 0.5) - 0.5) / pixelStep;
    float line = 1.0 - smoothstep(0.35, 1.25, distanceToLine);
    float spacingFade = 1.0 - smoothstep(0.18, 0.4, pixelStep);
    return line * spacingFade;
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
    float metres = max(vElevation, 0.0);

    // Contour terms use derivatives, so they are computed before any branch.
    float minorContour = contourLine(metres / 100.0);
    float indexContour = contourLine(metres / 500.0);

    // Shading normal: baked from elevation, plus fine noise relief that appears when the camera is close.
    vec4 detail = texture2D(reliefDetail, uv);
    vec3 normal = vec3(detail.r * 2.0 - 1.0, 0.0, detail.g * 2.0 - 1.0);
    normal.y = sqrt(max(1.0 - dot(normal.xz, normal.xz), 0.01));
    float closeUp = 1.0 - smoothstep(60.0, 420.0, vDepth);
    if (closeUp > 0.01) {
      vec2 noisePoint = vPlane * 6.0;
      float base = fbm3(noisePoint);
      vec2 gradient = vec2(fbm3(noisePoint + vec2(0.1, 0.0)) - base, fbm3(noisePoint + vec2(0.0, 0.1)) - base) / 0.1;
      float roughness = 0.25 + 0.5 * smoothstep(0.0, 800.0, metres);
      normal.xz += gradient * 0.09 * closeUp * roughness;
    }
    normal = normalize(normal);

    // Albedo from elevation, dryness, slope rock and the subtle island-group tint.
    vec3 albedo = hypsometricColor(metres);
    float dryness = smoothstep(0.55, 0.8, fbm3(vPlane * 0.025)) * (1.0 - smoothstep(300.0, 900.0, metres));
    albedo = mix(albedo, srgb(vec3(0.66, 0.62, 0.36)), dryness * 0.35);
    float slope = 1.0 - normal.y;
    float rockAmount = smoothstep(0.22, 0.5, slope) * smoothstep(80.0, 700.0, metres);
    albedo = mix(albedo, srgb(vec3(0.5, 0.47, 0.44)), rockAmount * 0.75);
    float tint = region.a * 0.9;
    if (id < 0.5) tint = 0.0;
    albedo = mix(albedo, region.rgb, tint);

    // Beach above the waterline, wet and darker where the swash reaches.
    float beach = (1.0 - smoothstep(0.72, 0.92, vLand)) * (1.0 - smoothstep(4.0, 60.0, metres));
    float wetSand = 1.0 - smoothstep(0.52, 0.74, vLand);
    albedo = mix(albedo, sandColor, beach * 0.9);
    albedo *= 1.0 - wetSand * 0.35;

    // Weather: clouds shade the ground and rain darkens and glosses it.
    vec3 sunDir = normalize(sunDirection);
    float cloudShade = cloudShadowAt(vWorld);
    float wet = smoothstep(0.1, 0.6, weatherAt(uv).a) * cloudStrength;
    albedo *= 1.0 - 0.22 * wet;

    float diffuse = clamp((dot(normal, sunDir) + 0.2) / 1.2, 0.0, 1.0);
    float occlusion = 1.0 - detail.b * 0.55;
    vec3 ambient = mix(groundLight, skyLight, normal.y * 0.5 + 0.5);
    vec3 direct = sunColor * diffuse * (1.0 - 0.6 * cloudShade);
    vec3 color = albedo * (ambient * 0.5 * occlusion + direct * 0.95 * mix(0.55, 1.0, occlusion));
    color *= 1.0 + detail.a * 0.12;
    vec3 viewDirection = normalize(cameraPosition - vWorld);
    float sheen = pow(max(dot(reflect(-sunDir, normal), viewDirection), 0.0), 30.0);
    color += sunColor * sheen * wet * 0.25 * (1.0 - cloudShade);

    float landOnly = smoothstep(5.0, 25.0, metres) * smoothstep(0.6, 0.9, vLand);
    float contourZoom = 1.0 - smoothstep(550.0, 1100.0, vDepth);
    float lines = max(minorContour * 0.1, indexContour * 0.26) * contourStrength * landOnly * contourZoom;
    color = mix(color, color * vec3(0.55, 0.45, 0.38), lines);

    // Aerial perspective and lightning.
    color = mix(color, fogColor * 0.9, (1.0 - exp(-vDepth * 0.0004)) * 0.35);
    color += vec3(0.9, 0.92, 1.0) * flash * 0.08;
    gl_FragColor = vec4(applyFog(color, vDepth), 1.0);
    #include <colorspace_fragment>
  }
`;

# Rendering and motion budget

- Native browser scrolling replaces the removed GSAP/Lenis choreography and its always-running page tickers. The title no longer creates per-word animation layers.
- The hero has one short entrance, no perpetual ornament/compass loops, and a thin aligned bevel: top at the source coordinates, middle/base at 1.5/3 SVG units, shadow at 5. The full map stays inside the mobile hero.
- National statistics start paused. Visitors can explicitly start their rotation; initial facts render with their real values in HTML, and later value changes retain finite easing.
- Ambient sea/cloud/wind/rain/lightning effects run whenever their layers and forecast conditions are active and the map is visible. Pausing the forecast timeline freezes the selected forecast time, not the weather visualization. Cloud shader detail and resolution are unchanged.
- Forecast Play advances forecast time using a 30 Hz update budget. Animated-effect-only frames are capped at 30 FPS; actual camera interaction and morphing remain responsive at display cadence. Disabling damping is not required: its settled state no longer perpetuates rendering.
- Weather activity is computed when fields change, not for every frame. Activity inspects regional wind vectors rather than a national mean, which can be zero for opposing winds. An inactive future forecast does not request animation work.
- Offscreen/hidden maps cancel scheduled frames and timers. Resuming uses a fresh time baseline; disposing releases scheduled work and GPU resources.

`tests/browser/performance.spec.ts` checks the mobile/desktop bevel, contained hero map, absence of perpetual hero animation, idle rendering, Play/Pause behavior, and offscreen suspension. Other browser fixtures mock AdSense so UI checks do not generate real advertising impressions.

For comparative profiling, use the same normal-motion Chromium viewport (390 × 844, DPR 2), block the advertising SDK, let initial loading settle, then sample two seconds at the hero and two seconds with the map visible. Count executed RAF callbacks and WebGL draw calls, and read CDP `Performance.getMetrics` TaskDuration deltas. These are local headless workload measurements, not physical GPU utilization, production field data, or a phone battery benchmark. Keep the browser idle and do not run other browser tests during the sample.

One local before/after sample with those conditions measured hero RAF callbacks at 158/s → 0/s (main-thread tasks 190 → 6 ms per sample). An earlier optimization froze weather while the timeline was paused and measured 115/s → 0/s WebGL draws (2168 → 1 ms main-thread tasks). That behavior was rejected: visible weather now animates independently of timeline playback, so the zero-draw figure does not describe the current visible map. Sampling and command overhead can extend the nominal two-second window; these single samples demonstrate eliminated idle work, not a general production speedup percentage. Visible ambient weather, active playback and camera interaction intentionally still render.

## Initial delivery and crawlability

- The homepage and legal pages are prerendered in all 13 locales. Meaningful content, a single H1, lists and landmarks exist without JavaScript; the client hydrates the same content instead of assembling an empty document.
- Eager SVG/weather/region-coordinate code uses engine-free Mercator projection. Three.js stays with the lazily imported scene; no shader detail is reduced.
- The automatic ad SDK starts when its placement is within 500 pixels of the viewport. Its stalled-placement deadline still starts only on actual visibility.
- Service-worker installation caches the generated critical shell manifest, not every lazy bundle, catalogue and social image. Unvisited heavy content is not promised offline; visited immutable assets and large atlas data remain runtime-cacheable.

Open Graph locales, language alternates and source-revision authorship metadata are emitted into static HTML. Schema `dateModified` identifies the source revision, not the freshness of provider observations. `/llms.txt` is optional crawler guidance, not a ranking guarantee. Public crawlers remain allowed by the wildcard robots rule; the intentional `/api/` restriction must not be removed merely to satisfy an audit tool that labels any restricted path as "partial".

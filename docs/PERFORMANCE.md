# Rendering and motion budget

- Native browser scrolling replaces the removed GSAP/Lenis choreography and its always-running page tickers. The title no longer creates per-word animation layers.
- The hero has one short entrance, no perpetual ornament/compass loops, and a thin aligned bevel: top at the source coordinates, middle/base at 1.5/3 SVG units, shadow at 5. The full map stays inside the mobile hero.
- National statistics start paused. Visitors can explicitly start their rotation; the initial number count-up remains finite.
- A paused forecast is a static 3D scene. Camera interaction, selection, hover, theme, resize, layer or forecast changes request a new frame. Wind trails are primed when static forecast data changes so pausing does not remove the wind visualization.
- Forecast Play enables animated sea/cloud/wind/rain effects and uses a 30 Hz update budget. Animated-effect-only frames are capped at 30 FPS; actual camera interaction and morphing remain responsive at display cadence. Disabling damping is not required: its settled state no longer perpetuates rendering.
- Weather activity is computed when fields change, not for every frame. Activity inspects regional wind vectors rather than a national mean, which can be zero for opposing winds. An inactive future forecast does not request animation work.
- Offscreen/hidden maps cancel scheduled frames and timers. Resuming uses a fresh time baseline; disposing releases scheduled work and GPU resources.

`tests/browser/performance.spec.ts` checks the mobile/desktop bevel, contained hero map, absence of perpetual hero animation, idle rendering, Play/Pause behavior, and offscreen suspension. Other browser fixtures mock AdSense so UI checks do not generate real advertising impressions.

For comparative profiling, use the same normal-motion Chromium viewport (390 × 844, DPR 2), block the advertising SDK, let initial loading/count-ups settle, then sample two seconds at the hero and two seconds with the map visible. Count executed RAF callbacks and WebGL draw calls, and read CDP `Performance.getMetrics` TaskDuration deltas. These are local headless workload measurements, not physical GPU utilization, production field data, or a phone battery benchmark. Keep the browser idle and do not run other browser tests during the sample.

One local before/after sample with those conditions measured hero RAF callbacks at 158/s → 0/s (main-thread tasks 190 → 6 ms per sample). With the default paused map visible, WebGL draw calls changed from 115/s → 0/s and main-thread tasks from 2168 → 1 ms. Sampling and command overhead can extend the nominal two-second window; these single samples demonstrate eliminated idle work, not a general production speedup percentage. Active playback and camera interaction intentionally still render.

# Atlas Nusantara architecture

## One linked atlas

SvelteKit with adapter-static serves a client-rendered application. `RegionAtlas.openRegion(code)` is the shared entry point for the table, saved places and city links. Region selection flows back to the page so the table highlights the same province and the weather readout follows the city. Camera flights preserve the national projection across province packages. A separate high-resolution identity window keeps city highlights/picking precise when zoomed in; weather readouts use the same nearest-step tolerance as the interpolated field.

The directory is **Kepmendagri 300.2.2-2430/2025: 38 provinces / 514 cities-regencies** (416 kabupaten, 98 kota). The maintainer explicitly authorized this migration from the previously shipped 2022 directory. Boundary vintage remains independent: the map uses COD-AB/BPS geometry valid 2020-04-01, regrouped through an explicit crosswalk. This is not certification of 2025 boundary lines.

`src/lib/map/` separates projected geometry, relief sampling, snapshot interpolation, typed overlay input, particles, shaders and scene/camera coordination. Three.js is lazy-loaded as the map approaches the viewport; the renderer caps pixel ratio, pauses offscreen/hidden and disposes resources on mode or route changes. Missing WebGL/context loss falls back to `SvgMap`. Buttons and the directory remain the keyboard alternatives to small polygons.

Wind, cloud, rain and sea visuals use a saved BMKG forecast, not a runtime provider call. ETOPO1 supplies terrain elevations and seabed depths. Wind particles follow interpolated vectors; cloud coverage and rain follow forecast fields. The camera passes through a visual cloud deck when zooming down; its altitude is a presentation convention, not measured cloud altitude. Sea motion is wind-derived, not a wave observation. Reduced motion freezes ambient effects and skips camera interpolation.

## Motion and interface

GSAP provides short hero/heading transitions. Lenis is the sole page smooth-scroll engine and excludes the map, dialogs, tables and directory. Both are bypassed for reduced motion. MapControls alone owns wheel/pinch camera gestures; page scrolling outside the map remains ordinary navigation.

Paraglide supplies 13 locales. The language picker is a native dialog with flags and native-language names; mobile settings group language, share and theme. A control-centred View Transition switches themes where supported. Source/edition details and roadmap prose do not occupy the homepage.

## Static routes and errors

The build retains `200.html` for offline recovery, emits `index.html`, copies shells to `terms/index.html` and `privacy/index.html`, and emits a `404.html` router shell. Workers Static Assets uses `not_found_handling: "404-page"`: known pages return 200, unknown routes return 404 and render the illustrated Svelte error view. **Do not restore `/* /200.html 200`**: it incorrectly rewrites real data assets.

Unexpected client errors expose only a safe incident reference. Independent `500.html` and `503.html` pages need no JavaScript, fonts or image requests; a host must serve them with the appropriate status when using them as infrastructure fallbacks.

## Two distinct data paths

Scheduled snapshot refreshes are defined separately in [SNAPSHOT_REFRESH.md](SNAPSHOT_REFRESH.md): forecasts every two hours and earthquake archives every fifteen minutes. They can publish to an optional R2 snapshot CDN without Git churn; activation/credentials remain operator setup.

1. **Checked-in snapshots:** forecast and earthquake archive assets are deliberately fetched with scripts and bundled with a release. They retain dates and attribution; weather cards can display them offline without implying live conditions.
2. **Reviewed-source publication:** the Worker’s cron scheduler collects only approved sources into D1, applies retention, and publishes 30-day hot summaries/current warnings to versioned R2 objects. Production browsers read these through the configured public R2 CDN. Cold exports alone query D1 after Turnstile, rate limits and a daily budget.

Disaster reports and weather hazards come from the offline [hazard pipeline](HAZARD_PIPELINE.md) (BNPB, PetaBencana.id, ANTARA, GDELT, BMKG CAP) as one dated snapshot that the browser validates before drawing; InaRISK polygons remain unconnected. Current CAP warnings are never substituted with stale saved alerts. Inactive CAP items are skipped; malformed or incomplete warning crawls fail closed.

## Device privacy

Region pins use `nusantara:pins:v1`; the rounded current location uses `nusantara:current-location:v1`. Coordinates are acquired only after a click, processed locally against the snapshot, and never included in map-data requests, share links or PNG sharing inputs. Cross-tab storage events refresh cards. Explicit aliases upgrade six old Papua Barat Daya city codes.

Notification permission is not a push subscription. The separate Node push prototype still needs deployment identity, VAPID and consent design. Local checks do not prove live delivery, translation quality or native iOS/Android installation.

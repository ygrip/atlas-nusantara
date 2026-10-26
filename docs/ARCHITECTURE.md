# Nusantara architecture

## Browser

SvelteKit SPA with adapter-static, a catch-all atlas route, versioned offline shell and installable manifest. The build keeps `200.html` for offline fallback and emits `index.html` for Workers Static Assets. Do not restore the legacy `/* /200.html 200` redirect: it also rewrites real JSON assets and can cause redirect loops.

Geography is projected and simplified offline using Mapshaper/d3-geo. Browsers load precomputed province-only SVG path packages; one translated search directory is the accessible alternative for small islands. Shallow SVG depth layers supply 2.5D without WebGL, Three.js or Godot overhead. Camera transforms, pointer gestures and keyboard controls do no geographic joins.

The historical code edition is **Kepmendagri 100.1.1-6117/2022: 37 provinces / 514 cities-regencies**. A boundary edition is independent of that code edition. No current 38-province source is silently joined to it. Actual polygons await licensed, vintage-compatible inputs.

Paraglide serves 13 locales with a browser-local language preference. Nunito and Lucide assets are self-hosted; Chart.js is loaded on demand. Theme changes use a control-centered View Transition when supported and bypass motion under reduced-motion preferences. Weather illustrations are explicitly decorative, opt-in and paused offscreen; they never represent measured conditions.

## Cloudflare

Workers Static Assets hosts the SPA at `nusantara.readynaz.com`. The Worker owns read-only `/api/*` routes and a five-minute Cron Trigger; each enabled source has a separate persisted next-due time. D1 holds normalized observations, source state and the manually seeded hierarchy. Scheduled materialization publishes a 30-day hot summary and current JSON to versioned R2 objects, then promotes a manifest last. The crawler does not refresh administrative codes or boundaries.

Only reviewed, approved providers enter a publication. Production browsers read hot JSON directly through a public R2 custom domain and CDN, not the application Worker or D1. They validate absolute publication expiry and do not keep provider data in service-worker CacheStorage. Ordinary region reads use Git-versioned assets. Cold JSON/CSV downloads alone query D1 after canonical Turnstile verification, native rate limits and a global daily budget. Exports use `no-store` and strict 365-day event/first-seen filters. Visitors have no accounts or login. See [CLOUDFLARE.md](CLOUDFLARE.md) for cache/deletion limits, operational budgets and deployment gates.

Warnings, earthquake observations, historical incidents and long-term hazards are distinct products, not interchangeable alert states. CAP polygons are not guessed into administrative codes. Failed, incomplete, stale or unsupported warning crawls withhold current-warning publication. Retained historical warnings remain labeled archive data.

## Device and sharing privacy

Location permission requires a user gesture. Rounded coordinate pins and region preferences remain in localStorage; the crawler does not receive them. Sharing draws a local PNG from public region/geometry/summary inputs with source/date and safety wording. Preview, native share, PNG download and copy-link fallbacks do not upload private device state.

The optional Node Web Push prototype is isolated in `server/`, not part of the Worker bundle. It needs a separate production identity/consent design, VAPID setup and source-region validation before browser delivery can be enabled. Permission alone never means subscribed.

## Verification

CI uses the npm lockfile, locale/Svelte/Worker type checks, Node tests, production browser tests, isolated local workerd/D1 integration and Worker packaging dry run. These checks do not certify human translation quality, data rights, authoritative borders, production delivery or native mobile installation.

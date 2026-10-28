# Installation, cache busting and updates

The flow follows the relevant `trick-it` patterns: one SvelteKit-owned registration, `updateViaCache: 'none'`, an explicit installation action and offline shell caching. No PWA plugin or visitor account is needed.

## Install

The install invitation is visible only on mobile-sized coarse-pointer web browsers that are not already running standalone. It is absent from desktop web and installed PWAs. Chromium's `beforeinstallprompt` is captured but never opened automatically. **Install app** invokes the native prompt only after a click. Browsers without that event receive menu guidance; Safari uses Share → Add to Home Screen. Standalone mode and `appinstalled` remove the offer. HTTPS, a production build and actual browser support are required; a simulated event test is not proof of native iOS installation.

The manifest includes real 192/512 PNG icons, an Apple touch icon and standalone display. These are generated from the text-free Indonesian clay emblem used in the site header and favicon; regenerate with `npm run generate:icons` after installing Playwright Chromium. Application and browser chrome colors follow the saved light/dark theme.

## Update

New workers cache the shell and **wait**, rather than calling `skipWaiting()` during install. The app checks in the background while visible/online and on resume, without replacing a worker that is already installing or waiting. There are no update buttons, update notices or already-installed controls.

The browser activates a waiting worker after the old app windows close; there is no forced mid-session reload. Activation retains the immediately previous shell cache so old immutable imports have a grace fallback. Reopening preserves browser-stored locations/preferences and the public region URL; temporary previews and camera state are not promised to survive it.

## Notification settings

When browser permission is granted, the control shows **Disable notifications** instead of asking for permission again. The on/off setting persists in IndexedDB so the page and service worker share it. Disabling saves the opt-out before unsubscribing any existing push endpoint and closing displayed notifications. The service worker checks the setting before displaying every push and suppresses delivery if the setting cannot be read. Browser permission itself cannot be revoked by website code; visitors can revoke it in browser site settings. Enabling does not create a live alert subscription: production push delivery remains unconfigured.

## Cache policy

- Vite hashes JS/CSS and serves `/_app/immutable/*` with immutable one-year HTTP caching. A generated `/pwa-shell.json` lists only the actual page modulepreload/stylesheet dependencies, `/200.html`, manifest, app icons, logo and critical font. Installation validates the same-origin path list and precaches this bounded shell; a malformed/unavailable manifest fails installation instead of creating an incomplete offline cache.
- Other immutable modules and large data/catalogue assets enter the release cache only after they are requested successfully. First install does not fetch unused maps, province datasets, fonts, or any of the 13 social-preview images. A successful initial install still contains the static offline fallback.
- SvelteKit's release version names shell caches and versions mutable administrative/geometry JSON requests. Offline matching ignores that query only inside the release-scoped static cache.
- HTML is `no-store`; the worker and manifest revalidate; `/_app/version.json` is `no-store` and is excluded from service-worker caching.
- Province geometry/city lists and relief are lazy, not a bulk GIS precache. Only requested packages are added at runtime. Release-versioned weather/earthquake assets are saved snapshots with visible dates, not current-warning publications.
- Provider `/data/published/*`, `/data/snapshots/*` and `/api/*` bypass service-worker CacheStorage. Hot publication HTTP caches obey their own short CDN TTL and absolute manifest validity. Cold archives are `no-store`; offline provider data is not represented as fresh.

Browser tests cover install-event consent/manual guidance, silent background update checks and location persistence, release-key requests, transparent PNG icons and the actual offline shell. Cache-policy tests validate shell manifest paths, bounds, duplicates and traversal rejection. Real OS install dialogs and installed iOS/Android rollout remain native-device checks.

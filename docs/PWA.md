# Installation, cache busting and updates

The flow follows the relevant `trick-it` patterns: one SvelteKit-owned registration, `updateViaCache: 'none'`, an explicit installation action, waiting-worker approval and offline shell caching. No PWA plugin or visitor account is needed.

## Install

Chromium's `beforeinstallprompt` is captured but never opened automatically. **Install app** invokes the native prompt only after a click. Browsers without that event receive menu guidance; Safari uses Share → Add to Home Screen. Standalone mode and `appinstalled` remove the offer. HTTPS, a production build and actual browser support are required; a simulated event test is not proof of native iOS installation.

The manifest includes real 192/512 PNG icons, an Apple touch icon and standalone display. Application and browser chrome colors follow the saved light/dark theme.

## Update

New workers cache the shell and **wait**, rather than calling `skipWaiting()` during install. The app checks while visible/online, on resume and through **Check for updates**, without replacing a worker that is already installing or waiting.

**Update and reload** sends a same-origin client message to activate the waiting worker. Only the approving tab reloads. Other tabs show their own notice instead of interrupting use; activation retains the immediately previous shell cache so old immutable imports have a grace fallback. **Later** dismisses the notice. Activation failures time out visibly rather than leaving a disabled action forever. Reload preserves localStorage locations/preferences and the public region URL; temporary previews and camera state are not promised to survive it.

## Cache policy

- Vite hashes JS/CSS and serves `/_app/immutable/*` with immutable one-year HTTP caching.
- SvelteKit's release version names shell caches and versions mutable administrative/geometry JSON requests. Offline matching ignores that query only inside the release-scoped static cache.
- HTML is `no-store`; the worker and manifest revalidate; `/_app/version.json` is `no-store` and is excluded from service-worker caching.
- Province geometry/city lists are lazy, not a bulk GIS precache. Only requested data packages are added at runtime.
- Provider `/data/published/*`, `/data/snapshots/*` and `/api/*` bypass service-worker CacheStorage. Hot publication HTTP caches obey their own short CDN TTL and absolute manifest validity. Cold archives are `no-store`; offline provider data is not represented as fresh.

Browser tests cover install-event consent/manual guidance, mocked waiting-worker approval and location persistence, release-key requests, real icon assets and the actual offline shell. Real OS install dialogs, installed iOS/Android behavior, production headers and deployed update rollout remain device/deployment checks.

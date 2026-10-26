# Nusantara Atlas

An Indonesian regional atlas and dated environmental-data archive, prepared for **https://nusantara.readynaz.com** on Cloudflare Workers.

**Not an emergency alert service.** Licensed 2022 boundary inputs are not bundled. Provider collection is off until dataset-specific reuse is reviewed and configured; no missing data is presented as an all-clear.

![Nusantara Atlas home, light theme](docs/screenshots/home-light.png)

| Schematic province tile map | Province details popup | Mobile |
|---|---|---|
| ![Tile map](docs/screenshots/atlas-tile-map.png) | ![Popup](docs/screenshots/province-popup.png) | ![Mobile](docs/screenshots/mobile-home.png) |

More screenshots and the design system: [DESIGN.md](docs/DESIGN.md).

## Included

- SvelteKit static SPA, install guidance/native prompt, consent-based PWA updates, versioned caches, 13 Paraglide locales, light/dark themes and reduced-motion support.
- Historical **37-province / 514-city-regency** directory, province-partitioned static data and a manually seeded D1 hierarchy.
- Claymorphic bento layout with sticky section navigation, a schematic 37-province tile map (not boundaries), a filterable province table with a details popup, and responsive layouts from 375 px.
- Offline Mapshaper + d3-geo SVG/JSON build, one province at a time. Layered 2.5D SVG, keyboard selection, wheel/button zoom, drag and touch pinch need no game engine or runtime GIS.
- BMKG earthquake/CAP parsers, reviewed-source scheduling, D1 archive and 365-day retention. Hot views use versioned static R2 JSON; cold downloads use Turnstile, rate limits and a daily query budget. No visitor login.
- Honest archive summaries, lazy Chart.js charts, source-attributed JSON/CSV exports, private-device pins, and preview-first client PNG sharing.
- Verified maker support links, source-code link, and a disabled-by-default, tracking-free text sponsor slot.

## Run and verify

Node 22.12+ and npm:

```sh
npm ci
npm run dev
npm run check:locales
npm run check
npm run worker:check
npm test
npm run test:browser
npm run test:worker
npm run worker:dry-run
```

Install browser runtimes once: `npx playwright install chromium webkit` (`--with-deps` on Linux CI). `test:worker` uses an isolated **local** workerd/D1 database and synthetic fixtures; it never activates providers or writes remote resources.

## Initial local D1 fill

```sh
npm run data:bootstrap
```

This builds the app, applies local migrations, fills all 551 historical hierarchy rows, invokes the scheduled handler once and stops the local server. With default empty source approvals it imports **no provider observations**. Review [Cloudflare setup](docs/CLOUDFLARE.md) before activating a source. No Cloudflare login is needed locally or by visitors. Production operator setup needs D1/R2, a confirmed public R2 CDN hostname/CORS/JSON caching rule, Turnstile keys, edge protection and source approvals. Set `VITE_PUBLIC_DATA_ORIGIN` before building; the Worker read fallback is local-only; production refuses a missing CDN origin.

## Historical codes and maps

The pinned community transcription is https://github.com/cahyadsn/wilayah/blob/master/db/archive/wilayah_2023.sql; its checked input SHA-256 is recorded in each generated seed. This is the historical Kepmendagri 100.1.1-6117/2022 edition, not current 38-province geography. See [source evidence](docs/DATA_SOURCES.md).

```sh
npm run import:regions -- --atlas-only --input /path/to/wilayah_2023.sql
npm run seed:hierarchy
npm run build:geometry -- provinces.geojson cities-directory provenance.json --province 11
```

The last command requires reviewed, licensed original boundary files; it does not invent polygons. SVG/JSON output can be versioned in Git. See [geometry contract](docs/GEOMETRY.md). Update code/boundary editions deliberately and rerun the seed; no region-code crawler is scheduled.

## Safety, privacy and remaining release work

Pins and rounded device coordinates stay on the device. PNG sharing accepts only public region codes and approved public summary data, never private device pins. Notification permission is not a push subscription. The optional [Node push prototype](docs/PUSH.md) is separate from the Cloudflare deployment and is not a production alert-delivery service.

Human translation review, licensed boundary acquisition, BNPB/InaRISK provider mappings/rights, production source activation, authenticated browser push delivery and actual iOS/Android device testing remain open in [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

Installation/update details: [PWA.md](docs/PWA.md). Further documentation: [ingestion](docs/INGESTION.md), [BMKG CAP](docs/BMKG_CAP.md), [localization](docs/I18N.md), [design/support/ads](docs/DESIGN.md), [sharing](docs/SHARING.md), and [architecture](docs/ARCHITECTURE.md).

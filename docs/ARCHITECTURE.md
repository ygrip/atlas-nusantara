# Nusantara architecture

The authoritative implementation plan is [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), with [DATA_SOURCES.md](./DATA_SOURCES.md) and [I18N.md](./I18N.md).

**Product architecture:** SvelteKit **SPA**, adapter-static, offline service worker, native SVG atlas geometry precompiled from licensed sources, region-partitioned JSON, browser-local saved pins and explicit geolocation permission. Remote Web Push needs a separate authenticated backend.

**Administrative code edition:** Keputusan Mendagri 100.1.1-6117/2022 has **37 provinces**, **514 kabupaten/kota**. This historical snapshot must not be confused with newer **38-province** boundaries or superseding 2025 regulations. Future boundary crosswalks will retain both source vintages.

**Data products:** Do not mix official live warnings, observed earthquake epicenters, historical BNPB incidents, InaRISK hazard modeling or WorldPop estimated exposure. Preserve source, validity and age.

**Localization:** Paraglide with 13 selected SEA languages and localStorage preference. User-facing labels belong in messages files only. Human review required for emergency content.

**CI:** npm install; npm run check:locales; npm run check; npm run build. Full historical region code export is available as a manually triggered Actions workflow.

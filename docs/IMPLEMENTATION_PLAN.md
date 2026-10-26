# Implementation plan

## Phase 0: Scaffold (this PR)
- [x] SPA with adapter-static fallback
- [x] Installable PWA manifest, offline service worker
- [x] Browser location and pin storage, notification permission
- [x] Paraglide + 13 locales + validation
- [x] Region code provenance (2022) and import script
- [ ] CI/browser validation of installability, fallback routing and i18n
- [ ] Human translation review, especially safety terminology

## Phase 1: Geographic map
- [ ] Build-time Mapshaper + d3-geo for 37 province and 514 city/regency SVG polygons
- [ ] Integrate original boundary source with explicit vintage/license checks
- [ ] National → Province → Kab/Kota navigation; no runtime GIS work
- [ ] Lazy-load small province-only geographic data; accessible search for small islands
- [ ] Assign boundary edition, code edition and source provenance independently
- [ ] Avoid heavy Gaussian blur per polygon and unnecessary WebGL

## Phase 2: Data ingestion
- [ ] Official BMKG weather warnings and earthquake adapters
- [ ] BNPB disaster incidents and InaRISK static hazard classes
- [ ] Optional NASA FIRMS and WorldPop background processing
- [ ] Distinguish active alerts, observations, historical incidents and long-term hazards
- [ ] Capture source time, valid-until, ingestion time, coverage and licensing
- [ ] Preserve unmatched administrative codes for review; do not guess geographic join
- [ ] Publish static JSON snapshots to CDN; never expose false real-time states

## Phase 3: Push notifications
- [ ] Authenticated worker API for Web Push subscriptions, VAPID keys, revocation
- [ ] Spatial match official warnings to user-selected regions
- [ ] Consent, minimal stored location scope, unsubscribe, TTL, deduplication
- [ ] Notification scheduling, quiet-hours preferences, rate limits
- [ ] iOS PWA/install behavior and Android/browser end-to-end tests
- [ ] Link to original BMKG/BNPB warning; no proprietary evacuation guidance

## Acceptance
1. Clean SPA load/deep link/offline load.
2. Location grant/deny/revoke and pin add/remove/persistence.
3. Notifications report unsupported, denied or granted honestly.
4. All 13 locales have complete messages and switch predictably.
5. Import 2022 exact 37-province/514-city edition, preserving zero-padded codes.
6. No claim that future API integrations already exist.

# Implementation plan and release gates

Status: implementation machinery and local verification are separate from verified production data and deployment. Unchecked items below are not claimed complete.

## Phase 0 — application foundation
- [x] Static SPA, deep links, install prompts/manual Safari guidance, consent-based PWA updates, release cache busting and PNG icons.
- [x] Explicit location permission, local pin add/remove/persistence and honest notification-permission states.
- [x] Paraglide, 13 complete locale catalogs and validation.
- [x] Historical 2022 code provenance and 37/514 hierarchy import.
- [x] CI definitions for static/unit/browser checks, local workerd/D1 and Worker dry-run packaging.
- [ ] Independent human translation review, especially safety terminology.

## Phase 1 — geographic map
- [x] Build-time Mapshaper + d3-geo projection, checksum/license/review guards and exact code-set validation.
- [x] Sequential province-only SVG/JSON output, with `--province` for one-at-a-time generation and Git storage.
- [x] National → province → city/regency directory, public region deep links and details.
- [x] Lazy geographic packages, accessible search, button/wheel zoom, drag and pinch; lightweight 2.5D SVG depth.
- [x] Independent code/boundary/source provenance; no per-polygon Gaussian blur or unnecessary game-engine runtime.
- [x] Local D1 hierarchy bootstrap and read API; manual updates rather than a scheduled code/border crawler.
- [ ] Acquire and review actual original 37-province/514-city boundary inputs for the historical edition. No invented map assets are shipped.
- [ ] Review real generated polygons visually and validate any historical crosswalk against primary sources.

## Phase 2 — collected environmental data
- [x] Official-schema BMKG earthquake JSON and CAP XML parsers with bounded, fail-closed validation.
- [x] Source registry with independent application polling intervals and published source references.
- [x] Explicit operator rights approval before collection/publication; inactive providers remain visibly unavailable.
- [x] Distinct warnings, observations, incidents and modeled hazards; source time/validity/retrieval/coverage/rights metadata.
- [x] Preserve unmatched administrative codes; do not join CAP area names to codes.
- [x] Atomic local snapshot publisher and scheduled R2 hot publication: versioned JSON, manifest-last promotion, 30-day summary window, expiry validation and direct-CDN production configuration.
- [x] Cold D1 downloads only after server-verified Turnstile, rate limits, daily query budget and bounded UTC windows; no visitor account/login.
- [x] Up to 365-day retention: strict read/export cutoff, preserved first-seen time and scheduled deletion.
- [ ] Approve and activate production BMKG datasets after dataset-specific reuse review; a parser is not a license grant.
- [ ] Verify and implement actual BNPB/InaRISK provider mappings, endpoints, editions and reuse terms. Canonical input contracts exist, but these integrations are not activated.
- [ ] Optional FIRMS/WorldPop authentication, rights and background processing, if later required.

## Phase 3 — notification delivery
- [x] Separate Node prototype with authenticated registration/revocation, exact region validation, endpoint allowlist, local durable storage, TTL/dedup/rate limits and quiet hours.
- [x] Worker-side notification payload validation, expiring warning IDs and preserved official BMKG/BNPB links.
- [x] UI distinguishes browser permission from a real subscription.
- [ ] Production anonymous-device consent/subscription design, VAPID secrets, durable shared delivery state and browser subscribe/unsubscribe integration. No visitor account/login is required or implemented; the separate private Node prototype is not the public API.
- [ ] Verified source warning-to-region matching, including a reviewed polygon/code crosswalk where required.
- [ ] Production push deployment and actual iOS PWA / Android end-to-end delivery and installation tests. The Node prototype is not deployed by the Cloudflare crawler.

## Phase 4 — presentation and sharing
- [x] Warm light/dark theme, reference-inspired theme reveal, reduced-motion behavior and responsive layout.
- [x] Informative collected-archive summary and lazy Chart.js visualization, with explicit incomplete-coverage caveats.
- [x] Source-attributed JSON/CSV downloads with approval/retention filters and spreadsheet-formula protection.
- [x] Client-only PNG share preview, native share/copy/download fallbacks and public-region URLs; no private pins or device coordinates.
- [x] Static production canonical/OG/Twitter/JSON-LD metadata, OG PNG, robots and sitemap. Only real locale URLs may be added as hreflang alternates.
- [x] Source-code and verified support links; disabled-by-default tracking-free sponsor slot.
- [x] Optional, clearly illustrative wind/cloud/rain assets with open-source license notices; no fabricated measured-weather overlay.

## Phase 5 — deployment gates
- [x] Worker configuration, local bootstrap, migrations, tests and packaging target `nusantara.readynaz.com`.
- [ ] Authenticate the intended Cloudflare account, create/confirm production D1, replace the placeholder ID and provision the custom domain.
- [ ] Apply production migrations/seeds only after target verification and explicit authorization.
- [ ] Configure public R2 custom domain/CORS/JSON caching/lifecycle/purge, edge WAF/rate limits, deployment-specific Turnstile widget/secret, and validate a real fresh-token download/replay rejection.
- [ ] Activate only approved sources; configure monitoring, failure alerts, physical cleanup and backup retention.

## Acceptance boundaries

Code checks establish local behavior, not authoritative source rights or production coverage. Preserve zero-padded 2022 codes, never mix a newer 38-province edition silently, never present missing records as an all-clear, and never claim an inactive integration or notification permission is live alert delivery.

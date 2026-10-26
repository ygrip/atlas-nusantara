# Nusantara disaster atlas: implementation plan

## Goal and contract
Mobile-first, lightweight, claymorphic SVG atlas. Navigate Indonesia (ADM0) → 38 provinces (ADM1) → kabupaten/kota (ADM2). Never render fabricated warnings as real data. Every indicator shows source, issuance date, validity window, geography resolution, and whether it is observed, forecast, historical or modeled hazard. Public safety notices must link to official agencies.

## Phase 1 — Verified boundaries and static geometry
- Choose a boundary dataset after confirming *geometry* redistribution rights (repository code licenses are insufficient). Pin source edition, URL and checksum.
- Normalize source codes to a canonical administrative ID and produce versioned crosswalks for BMKG/BPS/BNPB differences.
- Process shared topology once using Mapshaper; simplify national/coarse views more aggressively than ADM2; preserve small islands and validate polygon area loss.
- Project at build time to SVG paths; publish one national geometry asset and 38 per-province region assets with bounds. Select a kabupaten/kota via SVG viewBox, not extra map tiles.
- Build keyboard-operable SVG region buttons and a searchable list for tiny islands; honor reduced motion. Use one soft shadow per SVG group rather than per-path Gaussian filters.
- Target <100 KB Brotli national and <50 KB Brotli for a typical province; report any budget exceptions.

## Phase 2 — Source contracts and ingestion
| Layer | Provider | Type | Refresh trigger |
|---|---|---|---|
| Active weather warnings | BMKG CAP | official current warnings | ~5 min polling, expire using source validity |
| Recent earthquakes | BMKG | point observations | ~2–5 min, de-duplicate stable event IDs |
| Disaster history | BNPB Satu Data/DIBI | historical reports | on publication |
| Long-term hazards | BNPB InaRISK | static risk assessment | on source revision |
| Population exposure (later) | WorldPop | modeled population | on source release |
| Fire hotspots (later) | NASA FIRMS | satellite thermal detections | on satellite availability |

Validate allowed API usage, attribution, commercial reuse and caching before starting ingestion. Do not scrape around access restrictions. Ingest with Cloudflare scheduled Workers or an external batch job; process heavy spatial joins offline via Python/GeoPandas or DuckDB Spatial. Cache normalized region snapshots on R2/static CDN. Store optional metadata and job state in D1 only if justified. The client must not request upstream disaster APIs.

## Normalized event record
```ts
interface Observation {
 id: string; source: 'BMKG' | 'BNPB' | 'InaRISK' | 'NASA';
 kind: 'warning' | 'earthquake' | 'historical-disaster' | 'hazard' | 'hotspot';
 issuedAt?: string; observedAt?: string; validUntil?: string;
 sourceUrl: string; sourceCode?: string; canonicalRegionIds: string[];
 geometryRef?: string; longitude?: number; latitude?: number;
 confidence?: string; properties: Record<string, unknown>;
}
```

**Never** assign earthquakes to an impacted province using epicenter containment alone. Do not interpret modeled flood hazard as an active flood. Avoid a single synthetic disaster danger score.

## Phase 3 — Experience
- National map: selectable provinces, source-aware layer filters, dates, legend and provenance.
- Province map: kabupaten/kota geometry, relevant aggregates and search.
- Regency/city: focus to bounding box and show source-linked details, not a new vector-tile stack.
- Loading, no-data, stale-data, upstream-failure and unsupported-geography states.
- Accessible no-JS fallback and region list.

## Phase 4 — Localization and SEO
- All user-facing copy goes through Paraglide messages; English base locale, Indonesian and major national languages across Southeast Asia.
- URL-based localization, SSR correct html lang/dir and language links. Real administrative names remain proper nouns; translate explanatory content and units.
- Require translation key parity in CI and human review of legal/emergency terminology. Avoid fake machine-generated emergency instructions.
- For the actual atlas, Indonesia is the geographic scope, not all Southeast Asian country maps.

## Phase 5 — release checks
- Run `pnpm install && pnpm check:i18n && pnpm check && pnpm build`.
- Audit keyboard navigation, WCAG focus states, i18n URLs, RTL direction where applicable, performance budgets, topology, source freshness, attribution and disaster-safety disclaimers.
- Configure Cloudflare SSR adapter only when deployment target is decided; auto adapter is for initial development.

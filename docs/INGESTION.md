# Static data ingestion

Providers are not activated by default. Local parsers/publisher convert reviewed input into snapshots; the separate Cloudflare scheduled Worker acquires approved sources, keeps cold D1 history and publishes static hot R2 JSON. See [CLOUDFLARE.md](CLOUDFLARE.md) for freshness, caching and protected downloads. Catalog entries are not live data and parser availability does not establish reuse rights.

## Snapshot pipeline

`src/lib/data/ingestion/schema.ts` defines the versioned snapshot and required provenance. `adapters.ts` contains a BMKG earthquake JSON adapter and a canonical-feed adapter for warning, incident and hazard records. `scripts/ingestion/publish.ts` validates and writes a snapshot atomically. It writes no output if parsing or validation fails.

Input is JSON with these required top-level properties:

- `type`: `warning`, `earthquake`, `incident`, or `hazard`
- `payload`: the source payload (`Infogempa.gempa` object or array for earthquake observations; `{ "records": [...] }` for explicitly mapped canonical feeds)
- `provenance`: `source`, HTTPS `sourceUrl`, `sourcePublishedAt` (ISO timestamp or null), `fetchedAt`, `validUntil`, an allowlisted `license` identifier, HTTPS `licenseUrl`, `reviewedBy`, ISO `reviewedAt`, `coverage` (explicit list), and `edition` (string or null). Warnings require source publication and expiry times; expiry must be later.
- `generatedAt`: ISO timestamp

The publisher loads trusted region codes from `static/data/admin-2022/{provinces,cities}.json`. Input cannot declare its own trusted code set. Unknown codes remain in `unmatchedRegionCodes` for review. Writes use a unique temporary file and atomic rename.

Run with Node 22.12+ type stripping:

```sh
node --experimental-strip-types scripts/ingestion/publish.ts input.json static/data/earthquakes.json
```

Canonical records are runtime-validated and preserve `id`, `type`, `observedAt`, region-code candidates, geometry and scalar properties. Invalid enums, nested property values, malformed dates, numeric fields and administrative codes fail closed. Warnings, earthquake observations, historical incidents and modeled hazards have distinct types. An earthquake record remains an observation, not an alert.

## Source status and blockers

- **BMKG earthquakes:** official open-data documentation at https://data.bmkg.go.id/gempabumi/ lists JSON/XML, requires visible BMKG attribution, and limits access to 60 requests/minute/IP. The observed JSON endpoint is `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json`; its `Infogempa.gempa` array includes `DateTime` (ISO 8601 UTC), `Tanggal`, `Jam`, `Coordinates` (latitude,longitude), `Magnitude`, `Kedalaman`, `Wilayah`, and `Potensi`. The adapter prefers ISO `DateTime`, supports the single-object current-event shape, and parses localized fallback dates with explicit WIB/WITA/WIT offsets. The portal calls data open and mandates attribution, but extracted documentation does not state a blanket redistribution license. Legal approval is required for public redistribution; do not infer a reuse license.
- **BMKG warnings:** https://data.bmkg.go.id/peringatan-dini-cuaca/ documents RSS and CAP/ISO-XML feeds, updated as needed, visible BMKG attribution, and a 60 requests/minute/IP limit. The Indonesian feed is `https://www.bmkg.go.id/alerts/nowcast/id`; it lists provincial details and CAP links such as `/alerts/nowcast/id/{id}_alert.xml`, whose documentation names `effective`, `expires`, `senderName`, `headline`, `description`, `web`, and `area`. Its RSS currently states `copyright public domain`. The CAP adapter parses bounded official-schema XML and preserves polygons/source links without guessing administrative joins. Update/Cancel/unsupported or incomplete collections fail closed. Source activation still requires reuse review; region-matched push additionally needs a verified spatial/code crosswalk.
- **BNPB incidents:** API schema, code edition mappings and dataset-specific redistribution terms remain unverified. Supply an explicit mapper to canonical records after review.
- **InaRISK hazards:** layer geometry edition, field schema and redistribution permission remain unverified. Supply a reviewed canonical mapper and record the layer edition and license.
- **NASA FIRMS and WorldPop:** integrations remain disabled pending required credentials, dataset-specific license review and processing requirements.

The publisher requires explicit license identifier, license URL, reviewer and review date, but those are operator assertions—not automated legal validation. BMKG attribution and rate limits do not themselves establish redistribution permission. Keep source bytes, retrieval time and checksums in the upstream release process for reproducibility. Generated snapshots must not claim geographic coverage based merely on available records.

## Verification

Run isolated ingestion tests with `node --experimental-strip-types --test tests/ingestion/*.test.ts` on Node 22+. Tests cover ISO and local-time earthquake parsing, object/array feeds, trusted joins, publication, and fail-closed validation.

# Hazard data pipeline

`scripts/pipeline/run.mjs` collects disaster and hazard data from five public sources, cleans it, merges it and writes one dated snapshot, `static/data/observations/hazards.json`. The browser never calls a provider; it reads that file (through the CDN-or-local snapshot loader in `src/lib/data/saved-snapshot.ts`).

```
node --experimental-strip-types scripts/pipeline/run.mjs                 # everything
node --experimental-strip-types scripts/pipeline/run.mjs --skip=gdelt    # skip a source
node --experimental-strip-types scripts/pipeline/run.mjs --only=bnpb     # one source
npm run snapshot:hazards                                                  # same as the first line
```

Two schedulers run the same collectors:

1. **Cloudflare Worker (primary)**: `cloudflare/hazards.ts` runs from the existing `*/5 * * * *` cron. Every source has its own interval, claims itself in D1 (`source_state`, id `hazard:<source>`) so overlapping runs cannot double-fetch, stores cleaned events in `hazard_events`, then **re-aggregates everything stored** into one `hazards.json` published to R2 at `data/observations/hazards.json`. Off until `HAZARD_SOURCE_IDS` lists the reviewed sources (comma separated, e.g. `bmkg-cap,bnpb,antara,gdelt`; add `petabencana` only after reviewing its CC BY-NC licence).
2. **CI / local CLI (fallback)**: the `hazard` job in `.github/workflows/refresh-snapshots.yml` runs `run.mjs --due`. It merges into the previous file instead of rebuilding it.

### Per-source schedule

| Source | Interval | Event retention | Why |
|---|---|---|---|
| `bmkg-cap` warnings | 5 min | until `expires` | Warnings expire within hours |
| `petabencana` | 10 min | 7 days | Live citizen reports |
| `antara` | 15 min | 14 days | Feeds update continuously |
| `gdelt` | 30 min | 14 days | Rate limited (429), four paced queries per run |
| `bnpb` | 3 h | 60 days | Preliminary table updated through the day |

Intervals live in `scripts/pipeline/sources/registry.mjs`. A failing source is retried after at most 10 minutes and keeps serving its stored events (the snapshot marks it `failed`). Run `npm run build:gazetteer` after the administrative directory or geometry changes; it refreshes `cloudflare/generated/regions.json`, the place data the Worker geocodes with.

### Re-aggregation of existing data

`lib/schedule.mjs#reaggregate` unions stored and fresh events by id (fresh wins), drops records outside their source's retention, and `lib/aggregate.mjs` then dedupes news, caps per outlet, sorts newest first and trims to the 1.8 MB budget. So a run that touches only one source still publishes today's data from all the others. To seed the Worker with data already collected, run the CLI once and import nothing: the first Worker run per source fetches the provider's current window (BNPB 90 rows, PetaBencana 7 days, news feeds), which covers today. Use `--fresh` on the CLI to ignore the stored file.

## Sources

| Id | Source | What is taken | Kind | Notes |
|---|---|---|---|---|
| `bnpb` | [BNPB DIBI](https://gis.bnpb.go.id/databencana/tabel/pencarian.php) incident table (HTML) | Date, event type, regency code, district text, deaths, missing, injured, damaged houses/facilities | `official` | The page has no API; the table is parsed and **fails closed** if the header or column count changes. Preliminary data. Latest ~90 rows. |
| `petabencana` | [PetaBencana.id](https://docs.petabencana.id/general/jenis-bencana) `/reports` (last 7 days) | Six types: flood, earthquake, wind, haze, fire, volcano; point, time, text, flood depth | `citizen` | Unverified citizen reports. **CC BY-NC 4.0**, see Licensing. |
| `antara` | [ANTARA RSS](https://www.antaranews.com/rss/warta-bumi.xml) `warta-bumi` and `terkini` | Headline, link, time | `news` | Article text and images are never stored (copyright). |
| `gdelt` | [GDELT DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) article search | Headline, link, time, domain | `news` | Four Indonesian-language, `sourcecountry:ID` queries, 3-day window, paced 6.5 s apart (GDELT answers `429` otherwise). An empty `{}` response is valid. |
| `bmkg-cap` | [BMKG CAP nowcast](https://github.com/infoBMKG/data-cap) | Active weather warnings, area centre point | `warnings` block | Uses the existing fail-closed `adaptBmkgCap`; no region code is inferred. See [BMKG_CAP.md](BMKG_CAP.md). |

## Stages

1. **Collect** (`sources/*.mjs`): one module per source. Polite client in `lib/http.mjs` (User-Agent, 25 s timeout, size cap, bounded retry on 429/5xx honouring `Retry-After`).
2. **Clean** (`lib/text.mjs`): strip HTML and entities, control and zero-width characters, normalise Unicode and whitespace, cap lengths, remove outlet suffixes and `[VIDEO]` prefixes, canonicalise URLs (https only, no credentials, tracking parameters and fragments removed), parse RFC 822 / GDELT / ISO instants.
3. **Classify** (`lib/classify.mjs`): ten types (`flood`, `landslide`, `earthquake`, `volcano`, `fire`, `haze`, `wind`, `drought`, `tide`, `tsunami`) from ordered Indonesian/English keyword rules. A noise filter drops metaphors ("banjir promo", "gempa politik") and explainers ("Mengenal…", "Cara…").
4. **Geocode** (`lib/gazetteer.mjs`): built offline from the tracked 2025 directory and geometry. Representative points come from the largest-ring centroid of each regency polygon, un-projected with the shared Mercator parameters. Text matching uses full names first (`Kabupaten Agam`), then bare names of at least five letters that are not common words. **Ambiguity lowers precision instead of guessing**: "Bandung" (city and regency) resolves to the province only. BNPB rows use their regency code directly.
5. **Filter**: news must be at most 14 days old, not future-dated, a classified hazard, and (GDELT only) show an Indonesian place or agency. BNPB keeps 60 days.
6. **Dedupe** (`lib/dedupe.mjs`): news only. Same canonical URL, or same type, same region (when known), within 3 days and title similarity (Jaccard) of at least 0.72, collapse to one item; ANTARA outranks GDELT and the others are listed in `alsoReportedBy`. A per-domain cap (10) stops one outlet from dominating. Official and citizen records are never merged with news, so provenance stays visible.
7. **Validate** (`lib/event.mjs`): every record passes `makeEvent`: known kind/type, valid time, non-empty title, https URL, non-negative integer impact counts. **Coordinates survive only for `point` and `regency` precision**, so a province-level match can never be drawn as an exact spot.
8. **Write**: atomic `.tmp` + rename. A failing source never aborts the run: it is reported in `pipeline.sources` as `failed` and keeps its stored events. The CLI exits non-zero only when every attempted source fails.

## Output (`schemaVersion: 2`)

```jsonc
{
  "fetchedAt": "...",
  "warnings": { "items": [ /* BMKG CAP, centroid only */ ] },
  "events": {
    "sources": [ { "id", "name", "url", "termsUrl", "attribution" } ],
    "items": [ { "id", "kind", "source", "type", "title", "occurredAt", "place",
                 "regionCode?", "precision?", "lon?", "lat?", "url?", "detail?", "impact?", "alsoReportedBy?" } ]
  },
  "pipeline": { "mergedNews": 0, "sources": [ { "id", "status", "fetched", "kept", "rejected": { "reason": 0 } } ] }
}
```

`src/lib/data/hazards.ts` validates this shape in the browser (size caps, https-only URLs, coordinate ranges, unique ids). The map layer *Disaster reports* pins diamonds (official), circles (citizen) and triangles (news), coloured by type; *Weather hazards* pins BMKG warnings coloured by CAP severity.

## Licensing and limits

- **PetaBencana.id is CC BY-NC 4.0** (commercial use needs a separate CC BY 4.0 agreement). Review this before enabling ads or paid features, or drop `--skip=petabencana` into the CI step.
- ANTARA and GDELT content is copyrighted by its publishers; only titles and links are kept, each linking back to the original.
- BNPB DIBI figures are preliminary and revised later. The BMKG feed declares `public domain` but has not been legally reviewed.
- News geocoding is heuristic. Pins for news mean "this regency is named in the headline", not a verified incident site.
- GDELT was rate limited (`429`) during development, then returned empty. Its parser is covered by fixtures built from the documented response format, not a live article sample.

## Tests

`node --experimental-strip-types --test tests/pipeline/*.test.mjs tests/cloudflare/hazards.test.ts` covers cleaning, URL and date parsing, classification (including noise), geocoding ambiguity, event validation, news dedupe, and each source parser with fixtures, including the BNPB fail-closed layout checks. The Worker test runs the schedule against an in-memory SQLite stand-in for D1 (intervals, claims, failure retry, retention, re-aggregation, disabled-by-default). No test touches the network.

# Destination catalog ingestion

The destination viewer now publishes 18,596 unique factual, source-linked records collected from the public SISPARNAS data panel across 503 districts and all 38 source provinces. This replaces the 76-place runtime starter selection. It is not a verified complete inventory: the national API aggregate reports 18,982, and district totals report 18,970. Issue #5 remains open for those gaps, source reuse terms, per-record classifications, and image enrichment.

See [verified endpoints, licensing conflicts, and image research](TOURISM_RESEARCH.md).

## Static delivery and manual maintenance

Destination browsing has **no destination API, scheduled crawler, server-side query, or backend worker**. The browser reads these published files:

- `static/data/destinations/index.json`: compact Indonesia-wide totals and the 38 province shard URLs.
- `static/data/destinations/provinces/<code>.json`: complete records for one province, including reviewed image links and credits.
- `static/data/destinations/national.json`: the full Indonesia aggregate, with all 18,596 records and the same 241 credited images. It is available for explicit download and is not fetched on startup.
- `static/data/destinations/image-metadata.json`: image-verification evidence for offline maintenance and audit.

The map opens on the Weather layer and the national view. Choose Destinations from the layer popup (or open `/?layer=destinations`) to see the national destination summary; pick a province to fetch only that province's static shard. A valid `?region=` province/city URL opens that region. No device location is requested at startup.

Each province has a browser-only table: search by name, district or ID; filter category, district or photo availability; sort columns; and paginate through 10, 25 or 50 rows. These controls do not make new data requests. Switching province fetches its static JSON; no national aggregate or live provider request is needed.

For an occasional manual update:

1. Edit the affected province JSON and, when appropriate, the index's source/date/scope metadata. Keep official IDs and provenance; formatting alone must not claim a new source timestamp.
2. Run `npm run build:destinations` to regenerate province counts, the compact index and `national.json` locally. No network is used. Existing images are checked against their destination fingerprints; changed names or coordinates can invalidate old image matches.
3. Run checks/tests and `npm run build`, then publish the built static files through the existing hosting process. No destination worker deployment is required.

The crawler/import/enrichment commands below are optional **offline maintenance tools**, not production services or scheduled jobs.

## Source status

- SISPARNAS exposes the same public `POST /getdata/peta?scope=dtw` endpoint used by its data panel. Factual names, official identifiers, district/province labels and source coordinates were collected; descriptions and photographs were not copied. No source content license is asserted.
- Direktori Pariwisata advertises 8,383 records, but its later listing pages return 404 or a non-listing welcome page. Its public province-related detail lists were crawled separately as a partial research snapshot, not presented as complete.
- Data.go.id identifies an official DTW spreadsheet, but its reuse metadata conflicts. Its XLSX and government image collections remain unimported pending terms review.
- OpenStreetMap data may be reused under ODbL 1.0 with attribution and share-alike obligations. Use a suitable licensed extract/provider for bulk input; do not treat OSM's public map tile service as a bulk-data feed.
- The importer currently permits `ODbL-1.0`, `CC0-1.0`, `CC-BY-3.0`, and `CC-BY-4.0`. Verify the source's actual terms and the compatibility of combined records before using a license on this allowlist.

## Input format

Input is a local GeoJSON FeatureCollection. No network requests are made by the importer. Each feature must have a Point geometry with source-provided longitude/latitude and properties:

```json
{
  "id": "stable-official-source-id",
  "name": "Place name",
  "category": "natural | built | cultural",
  "sourceUrl": "https://source.example/place/123",
  "image": {
    "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg",
    "descriptionUrl": "https://commons.wikimedia.org/wiki/File:Example.jpg",
    "credit": "Photographer / source",
    "license": "CC-BY-4.0",
    "reviewedAt": "2025-04-02T00:00:00Z"
  },
  "imageReviewed": true
}
```

`image` metadata is optional. If an image is included, use a Wikimedia Commons `Special:FilePath` URL, include its description page, credit, license, and UTC review timestamp, and set `imageReviewed: true`. This tool does not look up or copy images. Cultural/heritage features are retained as `subtype: "cultural"` and represented as `kind: "built"` for compatibility with the current viewer categories. Classification must follow the source's meaning; unknown categories fail instead of being inferred.

A separate manifest is required:

```json
{
  "source": "OpenStreetMap extract",
  "sourceUrl": "https://download.example/extract",
  "license": "ODbL-1.0",
  "attribution": "© OpenStreetMap contributors",
  "retrievedAt": "2025-04-01T00:00:00Z"
}
```

Source identifiers must be stable and unique in the supplied extract. Duplicate identifiers, malformed coordinates, unsupported licenses, missing provenance, invalid categories, duplicate province matches, and points outside the pinned province geometry stop the run. Province codes are assigned by point-in-polygon against the pinned 2025 national boundary package; the importer never guesses from names or nearby administrative labels.

## Build

```sh
node scripts/destinations/ingest.mjs \
  input.geojson manifest.json \
  static/data/geometry-2025/national.json \
  static/data/destinations
```

The output is deterministic for the same input and retrieval timestamp:

- `index.json` (schema v2): source metadata, record totals, explicitly unknown national coverage (`sourceCoveragePercent: null`), and 38 province summaries `{provinceCode,count,natural,built,unknown,shard}`, plus the static `national` download URL.
- `national.json`: a schema v1 catalog with `countryCode: "ID"`, containing every province's records in stable province/ID order.
- `provinces/<code>.json`: one schema v1 shard for each of the pinned 38 provinces, including empty shards. Each `landmarks` record has a stable generated `id`, original `officialId`, name, province code, `natural`/`built` runtime kind, optional `cultural` subtype, verified source coordinates, source/license/attribution/retrieval provenance, and an optional reviewed image object `{url,descriptionUrl,credit,license,licenseUrl,reviewedAt}`.

The index totals describe this input only. A zero count means no matching records in this input, not that a province has no attractions. `sourceCoveragePercent` stays `null` unless a measurable denominator is provided by a future validated source contract. The browser loads `index.json` for summary markers and only fetches a province shard when that province is selected. The published index and shards contain 18,596 SISPARNAS records; `v1.json` is retained only as the original 76-place reference/test fixture. Of the collected records, 13,501 coordinates match the named province in the pinned geometry; other coordinates are omitted without removing the destination. None of these individual API responses establishes a category: all 18,596 remain explicitly unclassified. Commons enrichment has separately published verified image links for 241 records (220 distinct files); the remaining 18,355 keep placeholders. Aggregate type totals are not assigned to individual places. National completeness remains unknown. The table renders only its current page (10, 25 or 50 rows).

## Build the factual crawl snapshot

```sh
node scripts/destinations/crawl-directory.mjs tmp/directory-crawl
node scripts/destinations/crawl-sisparnas.mjs tmp/sisparnas-refresh
node scripts/destinations/build-sisparnas.mjs \
  tmp/sisparnas-refresh/inventory.json static/data/destinations
```

`crawl-sisparnas.mjs` defaults to one request per second and stores source response timestamps in its persistent cache. Add `--categories` to request explicit per-destination natural/artificial/cultural memberships; conflicting memberships stay unclassified. A fresh all-type crawl takes roughly 10–15 minutes at the default delay; category hydration adds roughly 25 minutes for 503 districts. Network latency and server-requested backoff add to those estimates. These refresh commands were unit-tested with recorded-shape fixtures, not rerun against the full remote inventory.

The directory crawler is resumable through its persistent HTTP cache, uses a one-second request interval, stops rather than following redirects, and records source failures. Exit code 2 means partial inventory, not success. Its scratch output is not a production dataset. The SISPARNAS builder accepts the sanitized crawl manifest, retains every source record with an explicit unknown category when needed, maps source province labels to the pinned edition (including swapped source IDs 91/92), and preserves source/district identifiers. It refuses publication if records are quarantined. Per-record fetch times were not retained by the initial research crawl. Its original recovered-output timestamp is stored in a separate `provenance.json` next to the scratch inventory; the builder requires that stable timestamp instead of substituting build time. The published index explicitly records that timestamp basis. New crawler runs record actual response timestamps. Rebuilding an unchanged inventory is deterministic. The builder reapplies `image-metadata.json` only where the destination name, province and coordinates still match its reviewed fingerprint; stale image entries are rejected and counted.

## Commons image enrichment

```sh
# Discover and verify without modifying published data:
node scripts/destinations/discover-images.mjs tmp/commons-discovery
# Publish the verified metadata to all affected province shards:
node scripts/destinations/discover-images.mjs tmp/commons-discovery --publish
```

The command reads the full current index and all 38 shards, not `v1.json`. It exports a bounded Wikidata candidate registry containing Indonesia (`P17=Q252`) subjects with a Commons image (`P18`), subject coordinates (`P625`), and Indonesian/English labels or aliases. This is not an exhaustive search of all Commons files: destinations missing from that registry or lacking trustworthy source coordinates stay unmatched.

Publication requires an unambiguous, distinctive exact normalized name and a subject-coordinate separation of at most 250 metres. Camera GPS alone is not used. Commons `imageinfo` must provide a supported reusable license whose URL agrees, creator credit and any custom attribution, an allowed image/CDN host, a file revision timestamp/SHA-1, and no explicit non-free/restriction flag. Unknown, non-commercial, GFDL-only, missing-credit, ambiguous and insufficient-evidence cases remain unpublished. The verified image registry records the subject, location proof, original file identity, credit, license, metadata retrieval time and destination fingerprint.

The full run evaluated **18,596** records: **684** had exact-name candidates, **268** passed location matching, and **241** passed image publication checks (**220 distinct files**). The **18,355** other records keep placeholders; that does not mean no photograph exists. Eight sampled published image links returned HTTP 200 during the link check; this was a sample, not an availability guarantee for every link. Verification is automated and explicitly labeled, not a claim that a person visually reviewed every photograph.

`image-metadata.json` is the public audit/refresh registry. Images remain hosted by Wikimedia; only URLs, proof and credits are stored. Creator credits and file/license links are visible below each image without truncation. Thumbnails are resized without CSS cropping, loaded lazily, and sent no referrer. The national overview does not fetch province destination data or photographs; startup location selection fetches only the selected province's destination data. Reuse conditions such as CC BY-SA continue to apply to downstream adaptations.

Successful HTTP responses are cached and transient Commons maxlag/rate-limit responses are backed off and retried. Interrupted runs resume from cache. Cached metadata retains its actual retrieval time rather than pretending to be newly reviewed; use a new cache directory for a fresh upstream review. Rerunning with the same catalog and cache is deterministic. Government photo-license approval is not required for these separately licensed Commons images.

## Multiple verified images and full-catalog review

The `image` field remains the backwards-compatible featured photograph. Destinations with multiple verified photographs also have an `images` array, with the same featured photo at index zero. Each entry has its **own** Commons file URL, attribution, copyright license, license link and review time. Gallery size is bounded to eight photos and duplicate Commons files are rejected. The image preview opens a keyboard-accessible gallery, adapted from Raksara's gallery lightbox, with left/right arrow keys, Escape, buttons and per-photo attribution.

The offline Wikidata/Commons discovery command now collects **up to eight** separately licensed P18 images for each location-verified subject rather than silently choosing only the first. Existing single-image registries remain valid. To rerun (a live internet connection is required):

```sh
node scripts/destinations/discover-images.mjs /path/to/research-cache --publish
npm run build:destinations
npm test
npm run check
```

**All-record image research queue**: use `node scripts/destinations/image-review-queue.mjs /tmp/atlas-image-review.jsonl` to generate one review item for each of the 18,596 records (or `--missing-only` to focus on gaps). Supports `--province=34` and `--limit=100` for bounded batches. Each item retains the stable destination ID, official name, province/district, verified coordinates if present, number of published photos, and human-facing Google Images and Wikimedia Commons discovery links. Research links are deliberately **not image data** and never become published photographs automatically.

Google's Custom Search JSON API stopped accepting new customers in January 2026 and existing access is scheduled to end January 2027. The review queue links to Google Images for human research, without screen scraping, bypassing bot protections, or embedding unlicensed image results. Do not replace missing photos with visually similar beaches or temples: require a verifiable destination identity, appropriate location evidence, creator credit, and reusable file license before adding a registry entry. Zero-verified-image records must continue to display the placeholder.

### Additional licensed Commons photo filling

There are **two** complementary offline enrichment passes. Neither requires GitHub Actions or a deployed image backend. They rewrite the province shards, national aggregate, index and audit registry only after evidence validation; records are never populated with guessed image links.

```sh
# Wikidata exact-name/location subjects, P18 photos, and Commons P373 categories.
npm run destinations:images:wikidata -- /tmp/atlas-photo-cache --publish

# Commons file pages with a distinctive destination name and geotag within 350m.
npm run destinations:images:commons -- /tmp/atlas-photo-cache --publish

# Optional: process a bounded province batch before searching the whole set.
npm run destinations:images:commons -- /tmp/atlas-photo-cache --province=34 --limit=100 --publish

# Generate a research queue for remaining gaps with Google and Commons links.
npm run destinations:images:queue -- /tmp/atlas-photo-review.jsonl --missing-only
```

The Wikimedia-only automatic pass cannot guarantee complete coverage: some source markers lack verified coordinates, Commons may not have a licensed photograph, and files may lack trustworthy subject evidence. Those destinations must retain placeholders until independently reviewed. Google Images pages are included for researcher navigation, not harvested or treated as image licensing evidence. The local passes use persistent request caches, throttling, and license/creator evidence. Existing verified photos remain intact if new discovery is incomplete.

### Recovery from Wikidata TimeoutError

If `npm run destinations:images:wikidata` fails inside `loadSubjectRegistry` with a Node/undici `TimeoutError`, update to the current PR branch and rerun the **same command with the same cache directory**. The crawler retries transient timeouts with backoff and increasingly generous client deadlines. Wikidata subject discovery now scans P18 and P373 separately in smaller pages instead of evaluating an expensive combined optional-property query. Successfully retrieved pages are cached by request URL and reused on later runs. Do not delete the cache directory to recover.

```sh
git pull --ff-only origin feat/destination-galleries-verification-20261027
npm run destinations:images:wikidata -- /tmp/atlas-photo-cache --publish
```

If the Wikidata Query Service continues timing out server-side, rerun or use the independent Commons filename-and-geotag pass instead; the latter does not depend on SPARQL. It is still not guaranteed to find valid images for every record.

These changes are committed with `[skip ci]` because automated actions are not necessary for local research and the project currently has a limited GitHub Actions quota.


### Destination-first Wikipedia photo lookup

Use this path **before** the nationwide Wikidata scan when enriching existing
SISPARNAS destinations. This script reads missing images from the existing
province shards, searches Indonesian Wikipedia first, then English Wikipedia,
and inspects each article's free lead image plus directly included files.

It does **not** paginate every Indonesian Wikidata item or require SerpApi.

```sh
# Dry run: 100 missing destinations; no production data changes
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --limit=100

# Publish only when matching article coordinates and Commons licenses are verified
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --province=34 --publish

# Review one province without publishing images
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --province=34 \
  --output=/tmp/atlas-wikipedia-yogyakarta.jsonl

# Continue a batch after the last destination ID from the previous review output
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache \
  --after=sisparnas-24702 --limit=100 --output=/tmp/atlas-next-100.jsonl
```

- **Article identity:** Requires exact distinctive normalized destination/article
  name, a Wikipedia article coordinate within 2 km of the independently
  verified SISPARNAS coordinate, and exactly one valid article match. This is
  intentionally stricter than Wikipedia search rank. The article is searched
  first in Indonesian, then English.
- **Image validity:** Image filenames must appear on that Wikipedia article.
  For publication, the image must have an acceptable Commons bitmap file,
  reusable license, credited creator, and independently checked metadata.
  Up to 8 independently attributed images may be stored for a destination.
  No Wikipedia thumbnail or arbitrary search result is published by itself.
- **Uncertain cases:** Destinations without coordinates, ambiguous Wikipedia
  titles, missing articles, or images failing metadata checks retain
  placeholders. Every scanned destination appears in the JSONL review report,
  with candidate article URLs even if it was not auto-published.
- **Cache:** Queries persist in subdirectories of the supplied cache directory;
  rerunning a failed province pass reuses successful cached results. The
  default report is \`/tmp/atlas-photo-cache/wikipedia-review.jsonl\`.
  Supply distinct \`--output\` paths for multiple runs, since reports replace
  the file.
- **Publication:** \`--publish\` updates \`image-metadata.json\`, the national
  aggregate, index and relevant province shards. Without this flag, the script
  writes **only** its review JSONL and HTTP cache. Previously approved photos
  remain in the registry. Commit and push from your machine only after review.
- **Batching:** \`--limit=N\` limits *processed* missing-image destinations, not
  Wikipedia result pages. \`--after=sisparnas-ID\` resumes scanning after a
  stable catalog destination ID, including IDs already processed on previous
  runs. \`--province=NN\` constrains the scan to one province.

Research-ready CSV of originally missing photos:
\`research/missing-destination-images.csv\` (18,355 records at export time).
It includes an appropriate name + district + province search query for each
destination. Image coverage after later publication may differ.


### Wikipedia crawl progress and diagnostics

The crawler now logs startup and **each destination**: name, ID, district, each
language request, result counts, coordinate-verified matches, duration,
and why the selected article produced no eligible photos.

- Ungeocoded destinations enter the review report as
  `skipped-no-verified-destination-coordinates` without an API request.
- The review JSONL adds `searchResults` and `imageChecks` arrays, which give
  per-file reasons such as unrelated illustration, missing Commons metadata,
  unsupported license/credit/format, or redirected file title.
- The summary includes `apiQueries`, `noCoordinates`, and `elapsedSeconds`.
- Use `--language=id` or `--language=en` for one-language scans; the default
  is `--language=both` (Indonesian then English if not matched).
- Cached HTTP responses persist. Reuse the same cache directory on retries.

```bash
git pull --ff-only origin feat/destination-galleries-verification-20261027

# Small diagnostic pass
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --limit=10 --language=id

# Inspect 100 places, no publication
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --limit=100

# Search a province, publishing verified licensed images
npm run destinations:images:wikipedia -- /tmp/atlas-photo-cache --province=34 --language=id --publish
```

The script searches Wikipedia **articles** by destination name alone, not
Google Images. It requires a distinctive exact article title and coordinates
within 2 km before examining Commons image files. This will have limited
coverage for small attractions that do not have matching Wikipedia articles.

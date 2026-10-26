# Cloudflare: static hot data, protected cold downloads

**Visitors need no account or login.** Cloudflare account authorization is needed only by the operator when provisioning or deploying infrastructure. Turnstile is bot verification, not visitor identity.

## Read/write paths

1. **Website:** SvelteKit Static Assets serves the shell, versioned JS/CSS, historical codes and offline-generated geometry at `nusantara.readynaz.com`.
2. **Hot data:** scheduled Worker → D1 → versioned JSON in `HOT_DATA` R2 → manifest promoted last. Normal browser views read this publication, never D1.
3. **Hot delivery:** production must point `VITE_PUBLIC_DATA_ORIGIN` at a **public R2 custom domain**, for example a separately confirmed `https://nusantara-data.readynaz.com`. Configure JSON cache eligibility, origin Cache-Control compliance and CORS for the website; ignore unused query strings in the hot-domain cache key to avoid cache-busting amplification. Verify `CF-Cache-Status: HIT` on repeated production reads. Requests then bypass the application Worker entirely. Do not use rate-limited `r2.dev` as the production CDN.
4. **Cold data:** a visitor explicitly requests an archive, solves Turnstile and submits `POST /api/export`. The Worker verifies the proof and budgets before D1 access, then streams an attributed JSON/CSV file. There are no public record-write APIs.

An empty `VITE_PUBLIC_DATA_ORIGIN` uses the same-origin `/data/published/*` R2-reader fallback **only on loopback hosts**. Production refuses a missing CDN origin, and its application Worker does not serve hot objects (`LOCAL_HOT_DATA_FALLBACK=false`). Local commands explicitly enable that fallback because Wrangler can rewrite request hostnames. This prevents silently deploying a per-view Worker/R2 read path instead of direct CDN delivery. Neither `caches.default` nor a native Worker rate limiter prevents the Worker invocation itself.

## Static publication contract

`GET /data/published/manifest.json`:

```json
{
  "schemaVersion": 1,
  "revision": "123e4567-e89b-42d3-a456-426614174000",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "validUntil": "2026-10-26T12:15:00.000Z",
  "summary": "/data/published/123e4567-e89b-42d3-a456-426614174000/summary.json",
  "snapshots": {}
}
```

The dates above illustrate the schema, not live data. Snapshot pointers use the same release directory, e.g. `earthquake.json` or `warning.json`. Missing/unapproved datasets have no pointer. The client accepts exact relative release paths only, rejects invalid/expired manifests and clears expired views on timers and tab resume. Release URLs bust payload caches; stable manifest reads use normal HTTP caching and are deduplicated for at most 60 seconds before revalidation. Service-worker CacheStorage never stores provider publications or cold API responses.

The initial hot window is **30 days**, with up to 50 summary observations and 200 snapshot records. Summary counts/facts describe that recent collected sample, not a national total. Current warning publication requires a complete, healthy collection; a collection exceeding its supported publication budget is withheld rather than silently truncated. Cold archives retain up to **365 days**.

Payloads upload before the manifest. R2 conditional ETags and publication timestamps prevent an older overlapping run from rolling back the active pointer. Public JSON has a 2 MB materialization budget. HTTP freshness is at most 60 seconds and bounded by publication validity; warning validity is also bounded by CAP expiry and last successful crawl +15 minutes. Source timestamps are preserved, never made fresh by republication.

**Public R2 cannot enforce hard access expiry.** `Expires` is not access control, and deleting an object does not purge an already cached response. Clients enforce absolute validity. Cron removes expired release objects; configure a short R2 lifecycle safety net (one day for these disposable hot projections), appropriate CDN expiry and purge procedures. Hot projections contain recent data, not the full year archive. Withdrawal of reuse approval requires republishing, removal and any necessary CDN purge; do not promise instant revocation of previously downloaded public files.

## Protected cold export

Native form fields: `kind`, `format` (`json`/`csv`), `from`, `to` (inclusive UTC `YYYY-MM-DD`) and `cf-turnstile-response`. JSON clients may send the same fields with `token`. Tokens never belong in query strings.

The server requires same-origin POST, a bounded body, valid dataset/date inputs, trusted `CF-Connecting-IP`, and configured production hostnames. It validates Turnstile server-side against `https://challenges.cloudflare.com/turnstile/v0/siteverify`, requiring `success === true`, action `archive_download` and the exact website hostname. Provider/network failures, replayed or expired tokens fail closed. `TURNSTILE_SECRET` is a Worker secret, never a browser variable or committed config.

Cost controls:

- Native request limiter: **10/minute per hashed IP**, before Siteverify; download limiter: **2/minute per hashed IP** after verification.
- Native shared budget: **20 verified requests/minute per Cloudflare location**, after successful Siteverify and the per-IP download check. Invalid proofs cannot exhaust this download pool. Native counters are approximate/eventually consistent per location, not a strict global quota.
- D1 atomic global daily budget: **20 verified archive attempts/day** by default (`COLD_DAILY_DOWNLOAD_LIMIT`), including requests rejected by the size preflight. This bounds expensive archive work across locations.
- Each request covers at most **31 UTC days**, at most **20,000 records / 10 MB of stored normalized payload**, with 500-row indexed keyset pages. Oversized requests return 413, never a silently truncated file. A conservative encoded-size preflight and a 32 MB stream guard also bound CSV quoting, attribution and JSON wrapper overhead; an unexpected mid-stream overflow aborts the download rather than silently completing a truncated file.
- Production edge WAF/rate-limit rules should reject disallowed `/api/*` methods/routes and abusive export traffic **before Worker execution**. Account/plan availability and thresholds need operator confirmation; in-Worker controls alone cannot cap incoming invocation charges.

Successful exports use `no-store`, enforce current source approval and the strict event/first-seen 365-day cutoff, preserve provenance/geometry/unmatched codes, and neutralize CSV spreadsheet formulas. Warnings in exports are historical records, not current alerts. Native browser downloads stream to a separate tab rather than buffering the archive into browser JavaScript.

`GET /api/export` returns 405. Legacy D1-backed `/api/summary`, `/api/sources`, `/api/regions` and `/api/snapshots/*` are removed (404). Regions come directly from Git-versioned `/data/admin-2022/*` assets.

## Scheduled sources and retention

Cron runs every five minutes; persisted per-source due times determine actual acquisition. Application policies: BMKG CAP 5 minutes, earthquake M5+ list 15 minutes. BNPB/InaRISK/FIRMS/WorldPop remain disabled pending verified schemas, editions, credentials where relevant and reuse rights. These intervals are not provider update guarantees. BMKG's earthquake portal publishes an attribution requirement and 60 requests/minute/IP ceiling; it does not itself grant a blanket dataset redistribution license.

Before activation, record dataset-specific `LICENSE`, `LICENSE_URL`, `REVIEWED_BY`, `REVIEWED_AT` in the matching `BMKG_EARTHQUAKES_*`/`BMKG_NOWCAST_*` vars and add the source to `APPROVED_SOURCE_IDS`. These operator records do not prove or grant rights. CAP area names are never guessed into historical administrative codes.

D1 cleanup deletes observations at 365 days by event or first-seen time; first-seen timestamps never reset. Old provider events cannot be reinserted after expiry. Cold reads independently enforce that cutoff even if deletion is delayed. Physical deletion occurs on successful scheduled execution, not at an exact midnight. Align database backup retention separately. Region codes/boundaries are manually reviewed seeds, not scheduled crawlers.

## Local use

```sh
npm run data:bootstrap
npm run worker:dev
```

Bootstrap builds, applies **local-only** migrations, seeds 551 historical hierarchy rows, invokes the scheduler once, writes a local R2 manifest and prints summary/source status. Empty approvals collect no provider records. The bootstrap stops its local server before returning. Plain `npm run dev` is UI development; the built Worker provides the complete local D1/R2 stack. Do not add `--remote` to bootstrap or integration commands.

## Production gates — not executed

Confirm the intended account and resource names before any remote changes. Create/confirm D1 and the dedicated hot R2 bucket, replace the placeholder D1 ID, apply migrations/seeds, and confirm custom domains. Public R2 access, CORS, JSON caching, lifecycle/purge policy and edge protections require explicit setup. Set `VITE_PUBLIC_DATA_ORIGIN` and the real public `VITE_TURNSTILE_SITE_KEY` before the production build.

Create or select a managed Turnstile widget for the confirmed website hostname, store its secret through the intended Worker's secret store and keep production `TURNSTILE_HOSTNAMES` free of localhost. Never paste secrets into chat. Confirm unique rate-limit namespaces for the account. Validate a fresh successful protected download and rejection of token replay against the actual deployed handler before calling the integration production-verified. No widget, secret, bucket, database, DNS record or deployment was created by local checks.

Official references: [R2 public custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/), [R2 caching consistency](https://developers.cloudflare.com/r2/reference/consistency/#caching), [Turnstile Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Worker rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [BMKG earthquakes](https://data.bmkg.go.id/gempabumi/), [BMKG CAP](https://data.bmkg.go.id/peringatan-dini-cuaca/).

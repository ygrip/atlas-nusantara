# Cloudflare Pages + D1 deployment

**Visitors need no account or login.** Cloudflare authorization is needed only by the operator provisioning or deploying infrastructure. Turnstile is bot verification, not visitor identity.

## Read/write paths

1. **Website:** Cloudflare Pages serves the SvelteKit static build at `nusantara.readynaz.com`.
2. **Published data:** a separate scheduled Worker collects only approved sources into D1 and writes versioned JSON publications to the `publications` D1 table. A Pages Function serves `/data/published/*` from D1 on the same hostname. No separate public data hostname or R2 bucket is required.
3. **Cache and cost:** JSON responses use public cache headers capped at 60 seconds and at publication expiry. Pages explicitly caches successful public JSON in `caches.default`, ignoring unused query strings and rejecting expired cache entries. Cache hits can avoid D1 reads but do not avoid Function invocations. Monitor Pages Function and D1 usage; application controls do not impose a hard incoming invocation-cost cap.
4. **Archive downloads:** Pages exposes `POST /api/export` through the existing server-side Turnstile verifier. D1-backed fixed-window request/download limits and an atomic daily export budget protect the handler. The production widget is `0x4AAAAAAFpTFqEhiXanSRaa`; its secret belongs only in Pages `TURNSTILE_SECRET`. Verification requires action `archive_download` and exact hostname `nusantara.readynaz.com`. Other methods return 405. No approved source means no archive is available, even after successful verification. There are no public record-write APIs.

The application reads same-origin `/data/published/*`. When no valid publication is available, it shows the unavailable state or dated bundled snapshots; bundled data is not live collection.

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

The scheduled publisher writes versioned payloads and promotes the manifest in one D1 batch. A conditional timestamp update prevents an older overlapping run from rolling back the active pointer. Public JSON has a 2 MB materialization budget. HTTP freshness is at most 60 seconds and bounded by publication validity; warning validity is also bounded by CAP expiry and last successful crawl +15 minutes. Source timestamps are preserved, never made fresh by republication. D1 cleanup removes expired versioned publications; the stable manifest is updated on each successful schedule.

## Protected cold export

Native form fields: `kind`, `format` (`json`/`csv`), `from`, `to` (inclusive UTC `YYYY-MM-DD`) and `cf-turnstile-response`. JSON clients may send the same fields with `token`. Tokens never belong in query strings.

The server requires same-origin POST, a bounded body, valid dataset/date inputs, trusted `CF-Connecting-IP`, and configured production hostnames. It validates Turnstile server-side against `https://challenges.cloudflare.com/turnstile/v0/siteverify`, requiring `success === true`, action `archive_download` and the exact website hostname. Provider/network failures, replayed or expired tokens fail closed. `TURNSTILE_SECRET` is a Worker secret, never a browser variable or committed config.

Cost controls:

- Pages D1 fixed-window request limiter: **10/minute per hashed IP**, before Siteverify; download limiter: **2/minute per hashed IP** after verification. These security-counter queries run before archive-record reads. The scheduler removes expired counters. The local Worker retains its native rate-limit bindings.
- Pages D1 shared budget: **20 verified requests/minute globally**, after successful Siteverify and the per-IP download check. Atomic conditional updates prevent concurrent over-consumption. Invalid proofs cannot exhaust this download pool. Fixed windows permit bursts across a boundary; they are not sliding-window limits.
- D1 atomic global daily budget: **20 verified archive attempts/day** by default (`COLD_DAILY_DOWNLOAD_LIMIT`), including requests rejected by the size preflight. This bounds expensive archive work across locations.
- Each request covers at most **31 UTC days**, at most **20,000 records / 10 MB of stored normalized payload**, with 500-row indexed keyset pages. Oversized requests return 413, never a silently truncated file. A conservative encoded-size preflight and a 32 MB stream guard also bound CSV quoting, attribution and JSON wrapper overhead; an unexpected mid-stream overflow aborts the download rather than silently completing a truncated file.
- Production edge WAF/rate-limit rules should reject disallowed `/api/*` methods/routes and abusive export traffic **before Worker execution**. Account/plan availability and thresholds need operator confirmation; in-Worker controls alone cannot cap incoming invocation charges.

Successful exports use `no-store`, enforce current source approval and the strict event/first-seen 365-day cutoff, preserve provenance/geometry/unmatched codes, and neutralize CSV spreadsheet formulas. Warnings in exports are historical records, not current alerts. Native browser downloads stream to a separate tab rather than buffering the archive into browser JavaScript.

`GET /api/export` returns 405. Legacy D1-backed `/api/summary`, `/api/sources`, `/api/regions` and `/api/snapshots/*` are removed (404). Regions come directly from Git-versioned `/data/admin-2025/*` assets.

Static Assets uses `not_found_handling: "404-page"`. The build prerenders the homepage and Terms/Privacy in 13 languages and emits a 404 router fallback; unknown URLs return HTTP 404 rather than rendering the homepage with 200. Local workerd integration verifies this routing. The `/200.html` asset is retained only for offline recovery; no wildcard redirect is restored.

Checked-in weather and earthquake snapshots are a separate, explicitly dated release asset path. They do not activate the scheduled source registry or current-warning publication.

## Scheduled sources and retention

The separate scheduler Worker cron runs every five minutes; persisted per-source due times determine actual acquisition. Application policies: BMKG CAP 5 minutes, earthquake M5+ list 15 minutes. BNPB/InaRISK/FIRMS/WorldPop remain disabled pending verified schemas, editions, credentials where relevant and reuse rights. These intervals are not provider update guarantees. BMKG's earthquake portal publishes an attribution requirement and 60 requests/minute/IP ceiling; it does not itself grant a blanket dataset redistribution license.

Before activation, record dataset-specific `LICENSE`, `LICENSE_URL`, `REVIEWED_BY`, `REVIEWED_AT` in the matching `BMKG_EARTHQUAKES_*`/`BMKG_NOWCAST_*` vars and add the source to `APPROVED_SOURCE_IDS`. These operator records do not prove or grant rights. CAP area names are never guessed into historical administrative codes.

D1 cleanup deletes observations at 365 days by event or first-seen time; first-seen timestamps never reset. Old provider events cannot be reinserted after expiry. Cold reads independently enforce that cutoff even if deletion is delayed. Physical deletion occurs on successful scheduled execution, not at an exact midnight. Align database backup retention separately. Region codes/boundaries are manually reviewed seeds, not scheduled crawlers.

## Local use

```sh
npm run data:bootstrap
npm run worker:dev
```

Bootstrap builds, applies **local-only** migrations, seeds 552 current hierarchy rows, invokes the scheduler once, writes the local D1 publication manifest and prints summary/source status. Empty approvals collect no provider records. The bootstrap stops its local server before returning. Plain `npm run dev` is UI development; `npm run worker:dev` serves the local scheduled Worker and D1 stack. `npm run pages:dev` exercises the Pages Functions adapter. Do not add `--remote` to bootstrap or integration commands.

## Production setup and activation gates

The Pages project is configured in `pages/wrangler.jsonc`; the scheduled Worker remains in the root `wrangler.jsonc` as `nusantara-atlas-scheduler`. Both must bind the same D1 database. Confirm the account and resource names, create/confirm the Pages project and `nusantara.readynaz.com` custom domain, create the `nusantara-atlas` D1 database, verify the database ID in both configs, apply migrations including `0005_publications.sql`, and seed the reviewed hierarchy before deploying. Pages build output and function routing are produced by `npm run pages:build`; deploy only after its build and dry-run checks pass. No remote resource, DNS record or deployment is created by local checks.

Keep `APPROVED_SOURCE_IDS` and `HAZARD_SOURCE_IDS` empty until dataset-specific reuse and attribution have been reviewed. Scheduled sources remain disabled by default. Apply `0006_request_rate_limits.sql` before deploying the protected Pages handler. Set the public `VITE_TURNSTILE_SITE_KEY` before building; keep the secret in the Pages secret store. The static site still works with dated bundled snapshots. A real successful download and replay-rejection check remains a production activation gate; local mocks and a dummy-token secret check are not end-to-end verification.

Official references: [Pages Functions configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Pages Functions advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Turnstile Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Worker rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [BMKG earthquakes](https://data.bmkg.go.id/gempabumi/), [BMKG CAP](https://data.bmkg.go.id/peringatan-dini-cuaca/).

## Hazard schedule

`cloudflare/hazards.ts` runs inside the same `*/5` cron after the approved-source crawl. Each hazard source has its own interval, stores events in D1 table `hazard_events` (migration `0004_hazard_events.sql`) and the Worker publishes the re-aggregated `data/observations/hazards.json` to the D1 `publications` table (`0005_publications.sql`). Pages serves this snapshot at `/data/live/hazards.json`, leaving the bundled `/data/observations/hazards.json` available as a dated fallback. Each enabled cron tick refreshes the projection's 15-minute validity without changing collection timestamps, even when no source is due. Set matching `HAZARD_SOURCE_IDS` values in both Wrangler configs after review. It does nothing until the `HAZARD_SOURCE_IDS` variable lists sources, so deploying is safe. A tick where every source is due can exceed 50 subrequests (up to 60 BMKG CAP detail pages plus the feeds and D1 calls), so use the Workers Paid plan or enable fewer sources. See [HAZARD_PIPELINE.md](HAZARD_PIPELINE.md).

## Why the Observatory can be empty, and how to fill it

The Observatory reads `/data/published/manifest.json`. Only the scheduled Worker writes it (sources → D1 → D1 publications); Pages Functions serve it from the same hostname. Local plain static hosting without the Pages Function or Worker has no manifest, so the section shows its unavailable state. The page still falls back to checked-in snapshots (earthquakes, hazards, forecast) and labels them with their saved date; these are not live collection counts.

To fill it for real:

1. Local: `npm run data:bootstrap` applies migrations, seeds regions, runs one scheduled collection and prints the published summary. `npm run worker:dev` serves the Worker locally; `npm run pages:dev` runs the Pages Function adapter.
2. Production: provision Pages and the separate cron Worker, bind both to the same migrated D1 database, and deploy the Pages build. No public data origin is needed. Keep sources disabled until approved.
3. Counts grow only after collection runs: each run stores new observations, and the summary covers the last 30 days. Right after the first run most counts are small.

## CI-gated production deployment

GitHub Actions runs `.github/workflows/ci.yml` for pull requests and `main` pushes. The `check` job validates locales, Svelte/TypeScript, Node unit tests, Worker types and dry-run, the production build, and Chromium smoke tests. It also rejects common accidentally committed credential files and token formats. A successful `main` build is uploaded as a one-day artifact and **deployed without rebuilding**:

1. **Pages:** `npx wrangler pages deploy --cwd pages --branch main --commit-hash "$GITHUB_SHA"` deploys the existing `nusantara-atlas` project, including Pages Functions and the production D1 binding.
2. **Scheduler:** `npx wrangler deploy --config wrangler.jsonc` deploys `nusantara-atlas-scheduler` only when `wrangler.jsonc`, `cloudflare/**`, or `src/lib/data/ingestion/**` changes. It runs after Pages succeeds. Use Actions → **Validate atlas** → **Run workflow** on `main` with `deploy_worker=true` to force a Worker redeploy; manual dispatch also redeploys Pages after CI.
3. **Safety:** PRs run only validation; never use a `pull_request_target` event for Cloudflare credentials. Superseded production runs are canceled. Both production deployment jobs use the `production` GitHub environment, with repository-scoped deployment secrets injected only into their Wrangler commands.

GitHub Actions repository **secrets**:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Account → Cloudflare Pages → Edit** and, for Worker deploys, **Account → Workers Scripts → Edit** on the intended account. The R2 snapshot publishing workflow (if enabled) needs *additional* R2 permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier (not itself an authentication secret). |

Optional GitHub Actions repository **variable** `VITE_TURNSTILE_SITE_KEY` configures the public browser-side Turnstile site key. If unset, CI uses the project's public site key `0x4AAAAAAFpTFqEhiXanSRaa`. The **secret** `TURNSTILE_SECRET` must remain encrypted in the Cloudflare Pages production environment. Never put it in `VITE_*`, YAML, GitHub build artifacts, or checked-in Wrangler `vars`.

Resource identifiers such as `account_id`, `database_id`, and the Turnstile *site* key are **not access credentials**. Retaining the database binding and Cloudflare account ID in the configuration makes local commands reproducible. The Wrangler file is the configuration source of truth for non-secret settings; existing encrypted Cloudflare secrets are retained across deployment.

**D1 migrations are deliberately not executed by CI.** Review and apply any new migrations using an authorized operator token before merging a release that requires them: `npx wrangler d1 migrations apply nusantara-atlas --remote`. Automatic migrations would require additional write permissions and could irreversibly change production data. Likewise, unrelated snapshot publishing remains separately opt-in.

The checked-in `scripts/check-deployment-config.mjs` enforces matching Pages/Worker D1 bindings and validates the deployment account against GitHub's `CLOUDFLARE_ACCOUNT_ID` secret without printing it. 

The basic credential guard does not scan Git history or replace GitHub secret-scanning/push protection. Enable those repository protections if available. Any token found in Git history must be revoked, even if the file is later deleted.

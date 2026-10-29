# Scheduled BMKG snapshots

`.github/workflows/refresh-snapshots.yml` defines two independent UTC schedules:

| Snapshot | Cron | Capture |
|---|---|---|
| BMKG forecasts | `0 */3 * * *` | Every 3 hours; about 10 minutes for 514 points at under 60 requests/minute |
| Daily weather history (Open-Meteo, last 7 full days, WIB days) | with the forecast job | 13 batched requests (40 points each); `static/data/weather/history.json` |
| BMKG M5+ earthquake archive | `*/25 * * * *` | Every 25 minutes (:00, :25, :50); one archive request |
| Hazards (`hazards.json`): BMKG CAP, PetaBencana, ANTARA, GDELT, BNPB | Worker `*/5` tick, per-source intervals 5 / 10 / 15 / 30 / 180 min; CI `*/25` with `--due` | See [HAZARD_PIPELINE.md](HAZARD_PIPELINE.md#per-source-schedule) |

GitHub scheduled runs can be delayed; this is not an emergency-delivery SLA. The forecast job is deliberately outside the request path and does not put 514 provider calls in a visitor request or a short Worker invocation.

## Enable collection

1. Review BMKG access/attribution terms and the intended GitHub Actions budget. Forecast collection alone uses roughly 80 runner-minutes/day. The 72 daily earthquake job starts and publishing add runner time; measure Actions usage and review private-repository quotas before enabling it.
2. Set repository variable **`SNAPSHOT_REFRESH_ENABLED=true`** to allow scheduled collection. Manual workflow dispatch can capture `weather`, `earthquake` or `all` independently.
3. Successful jobs upload a dated JSON artifact, retained for 7 days. They do not commit generated files, push to Git or redeploy the app on every refresh.

The flag is not set by this implementation. Workflow syntax and local snapshot validation have been checked; GitHub scheduled execution has not been production-verified.

## Enable publication to the snapshot CDN

After confirming the exact Cloudflare account and bucket, configure:

| Setting | Location |
|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret, scoped to the intended R2 bucket/account operations |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secret |
| `SNAPSHOT_R2_BUCKET` | Repository variable naming the confirmed existing bucket |
| `SNAPSHOT_PUBLISH_APPROVED=true` | Repository variable, after source and target review |
| `VITE_PUBLIC_SNAPSHOT_ORIGIN=https://…` | Public build variable: the bucket’s HTTPS custom CDN origin |

The publish step uses the pinned project Wrangler version, sets `application/json` and a five-minute cache TTL, and overwrites only these complete snapshot objects:

- `data/weather/forecast.json`
- `data/observations/earthquakes.json`
- `data/observations/hazards.json`

Configure the public custom domain, CORS for the atlas origin and the appropriate JSON cache rule. Neither bucket provisioning nor secrets nor remote writes were performed during local implementation. Do not use a broad account token or paste credentials into chat.

## Browser behaviour

When the CDN origin is configured, snapshot readers try its stable object URL first. HTTPS origins, size budgets, timeouts and snapshot schemas are checked; credentials and visitor coordinates are not included. If the CDN is unavailable or invalid, readers fall back to the explicitly dated release asset. That fallback is not relabeled fresh.

Visible map/cards refresh forecasts every two hours; earthquake pins/list refresh every fifteen minutes. These are CDN/asset reads, not direct BMKG calls. A fetched date and forecast/event times remain visible. Offline release snapshots remain distinguishable from current-warning publication.

## Separate current-warning pipeline

The existing Worker publication scheduler remains independently gated by its source approvals and expiry policy. Its base trigger checks persisted due times; the earthquake collector already uses a 15-minute interval. CAP warning expiry/fail-closed checks remain separate from the two-hour forecast cadence. Avoid enabling duplicate acquisition pipelines unnecessarily.

## Weather history and nearest-neighbour fallback

- BMKG publishes forecasts only, so `scripts/ingestion/weather-history.mjs` builds the 7-day daily history (mean/min/max temperature, rain, humidity, cloud, wind) from Open-Meteo (CC BY 4.0, free tier is non-commercial: review before relying on it with ads or switch provider). Point coordinates come from `static/data/admin-2025/forecast-points.json`.
- A city BMKG returned nothing for is listed in the forecast snapshot's `unavailable` array. The atlas shows the nearest forecast (within 250 km) with a note. History works the same way for cities with no daily values. With no neighbour in range the chart is empty with an explanatory message.
- The site serves these files from the deployed build. Until `SNAPSHOT_REFRESH_ENABLED`/publishing is configured, refresh by running both scripts and redeploying: `node scripts/ingestion/forecast-snapshot.mjs && node scripts/ingestion/weather-history.mjs && npm run build && npm run pages:deploy`.

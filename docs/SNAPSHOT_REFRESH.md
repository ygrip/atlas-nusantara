# Scheduled BMKG snapshots

`.github/workflows/refresh-snapshots.yml` defines two independent UTC schedules:

| Snapshot | Cron | Capture |
|---|---|---|
| BMKG forecasts | `0 */2 * * *` | Every 2 hours; about 10 minutes for 514 points at under 60 requests/minute |
| BMKG M5+ earthquake archive | `*/15 * * * *` | Every 15 minutes; one archive request |
| Hazards (`hazards.json`): BMKG CAP, PetaBencana, ANTARA, GDELT, BNPB | Worker `*/5` tick, per-source intervals 5 / 10 / 15 / 30 / 180 min; CI `*/15` with `--due` | See [HAZARD_PIPELINE.md](HAZARD_PIPELINE.md#per-source-schedule) |

GitHub scheduled runs can be delayed; this is not an emergency-delivery SLA. The forecast job is deliberately outside the request path and does not put 514 provider calls in a visitor request or a short Worker invocation.

## Enable collection

1. Review BMKG access/attribution terms and the intended GitHub Actions budget. Forecast collection alone uses roughly 120 runner-minutes/day. The 96 daily earthquake job starts and publishing add runner time; measure Actions usage and review private-repository quotas before enabling it.
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

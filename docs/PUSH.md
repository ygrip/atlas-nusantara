# Web Push service (deployment not configured)

**No visitor account or login is part of Nusantara.** Public hot reads are static; cold exports use anonymous Turnstile verification. The bearer-token Node code below is a private, development-only prototype, not the site's public subscription design and not a requirement for atlas visitors.

The push service is an optional, separate Node process. It is not wired to the static SvelteKit app and does not send notifications until deployed with VAPID credentials, durable private storage and an authenticated official-warning ingestion job. Permission granted in the browser is not a subscription.

## Run locally

Install the service dependency in the project before running:

```sh
npm install web-push
node server/push-server.mjs
```

Set these environment variables through a secret manager (never commit their values):

- `PUSH_ALLOWED_ORIGIN`: exact HTTPS origin of the deployed app, e.g. `https://atlas.example` (no path).
- `PUSH_SUBSCRIBER_TOKEN`: random secret, at least 32 characters, scoped to subscription registration and revocation.
- `PUSH_ADMIN_TOKEN`: a distinct random secret, at least 32 characters, only held by trusted ingestion infrastructure.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: VAPID pair and `mailto:` or HTTPS contact.
- `PUSH_REGION_FILE`: path to the generated `admin-2025/provinces.json`; only codes in this file can be subscribed to or matched.
- Optional `PUSH_STORE_FILE` (defaults to `./var/subscriptions.json`, mode 0600) and `PORT` (defaults to 8787).

The JSON file store is for a single process on persistent private storage only. It serializes mutations within one store instance and is not safe across multiple processes, multiple store instances writing the same file, horizontally scaled workers or ephemeral serverless disks. Replace it with an encrypted transactional store and shared rate-limit/deduplication storage before scaling. Protect the service with HTTPS, network controls, backups and a documented retention/deletion policy. Tokens are shared bearer credentials, not per-user identity; add user/device authentication before public production exposure.

## API

All non-health endpoints require exact `Authorization: Bearer <token>`. Browser-origin requests must match `PUSH_ALLOWED_ORIGIN`; requests without an Origin are accepted for server-to-server use, so the bearer secret must remain private.

- `GET /health`: process liveness only; does not prove VAPID or delivery readiness.
- `POST /subscriptions` with subscriber token: `{ "consent": true, "subscription": <PushSubscription JSON>, "regionCodes": ["32"], "preferences": { "quietHours": { "start": "22:00", "end": "07:00", "timeZone": "Asia/Jakarta" } } }`.
- `DELETE /subscriptions` with subscriber token: `{ "subscription": <PushSubscription JSON> }`.
- `POST /dispatch` with admin token: `{ "warning": { "id": "...", "source": "BMKG", "title": "...", "body": "...", "url": "https://...go.id/...", "regionCodes": ["32"], "issuedAt": "...Z", "expiresAt": "...Z" } }`.

Dispatch accepts BMKG warnings only from `bmkg.go.id` subdomains and BNPB warnings only from `bnpb.go.id` subdomains. URLs must use HTTPS without custom ports, credentials or fragments. Issued/expiry values must be ISO timestamps ending in `Z`, issuance must be within the last 24 hours, and the warning lifetime cannot exceed 24 hours. Expiry must be in the future and region codes must appear in the configured code file. The admin must authenticate/provenance-check the original official warning before submitting it; the API is not a source adapter. No unmatched code is guessed. Warning text is clipped and must contain factual alert text only, never synthesized evacuation guidance. Endpoint hosts are restricted to FCM, Mozilla and Apple push services to reduce SSRF risk. Expired subscriptions (404/410) are removed. Subscription records contain only endpoint/key material, selected region codes, quiet-hours preferences and creation timestamp—no precise coordinates, location name, or user profile. Records expire after 30 days; users should explicitly revoke when disabling notifications.

Dispatch serializes warning processing within one process, deduplicates warning IDs and caps delivery at three per subscription per hour. These controls reset on restart and are not adequate across multiple instances. Subscription TTL is rechecked on each store read; expired entries are pruned from the JSON file. A revocation racing a provider request cannot recall a push already handed to that provider. Quiet-hours suppress sends rather than queue them for later. Push delivery is best effort; providers may expire subscriptions or delay/drop messages.

## Browser integration still required

The frontend must generate or fetch the public VAPID key, call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` after an explicit consent action, send the resulting subscription and selected region codes, and call `unsubscribe()` plus `DELETE /subscriptions` on revocation. The static UI currently only requests browser notification permission and does not perform these steps. The worker currently has no contract enforcement for notification payload shape. Add user-facing subscription state/translations and end-to-end tests before enabling this API.

## Verification

Run `node --test tests/push/*.test.mjs`. Tests use fake delivery and temporary local files. No credentials, production worker, browser subscription flow, iOS installation behavior or external push provider delivery are included or verified. Generate keys with `npx web-push generate-vapid-keys` only in a secure deployment environment; do not check them into source control.

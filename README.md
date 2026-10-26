# Nusantara

Lightweight Indonesian environmental and disaster atlas. **Currently a scaffold, not a live emergency alert service.**

## Stack
- SvelteKit SPA, static hosting, offline PWA shell
- Paraglide JS, 13 Southeast Asian language locales
- Browser geolocation with explicit permission and locally pinned places
- Notification permission and service worker handlers (no push-delivery backend yet)
- Pinned historical Kemendagri 100.1.1-6117/2022 administrative codes
- Planned: claymorphic SVG map, BMKG warnings and earthquakes, BNPB incidents, InaRISK hazards

## Development

    npm install
    npm run check:locales
    npm run check
    npm run dev

## Region importer

Historical 2022 codes are not the same as the current 2025 edition.

Source: https://github.com/cahyadsn/wilayah/blob/master/db/archive/wilayah_2023.sql
Official decision: https://satudata.kuburayakab.go.id/dataset/25719dd0-2b84-43ba-8bd9-51e53edbb4ed/resource/7b339653-4a71-4dfb-a25e-dc1089d75176/download/kepmendagri-100-1-1-6-117-2022-data-wilayah-administrasi-pemerintahan.pdf

    curl -fL https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/archive/wilayah_2023.sql -o /tmp/wilayah_2023.sql
    npm run import:regions -- --input /tmp/wilayah_2023.sql

Imports and validates province, kab/kota, kecamatan and desa/kelurahan codes. The 37-province seed is included; generated province-partitioned detail is not bundled by default. Archive the downloaded input and SHA-256 to reproduce it. Community transcription must be checked against the primary decision.

## Safety and privacy

Geolocation is only requested by a user gesture. Pins stay on the current device. There is no backend upload. The service worker handles incoming push *if* a future authenticated VAPID delivery service is configured. Permission alone is not an active alert subscription.

See docs/IMPLEMENTATION_PLAN.md, docs/DATA_SOURCES.md, and docs/I18N.md.

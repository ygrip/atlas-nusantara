# Advertising

`config/ads.json` uses public publisher `ca-pub-5501931731194817` from trick-it and the operator-provided homepage slot `5292790825`. The operator requested `testMode: false`: live requests omit the `data-adtest` attribute. The validator accepts explicit boolean modes, and disabling `enabled` prevents the placement from rendering.

The homepage has exactly one configured placement. No Google SDK or advertising request loads until a visitor selects **Load advertisement**. The choice is per document and is not persisted. Legal links perform full navigation so Google's loaded SDK does not remain active in the Privacy Policy or Terms document. Reloading does not erase information Google may already have stored. Provider no-fill and SDK/ad-blocker failures never prevent the atlas from working.

The opt-in is not a certified consent-management platform. Site/ad-unit approval and applicable Google or regional consent requirements remain operator responsibilities. In particular, do not treat a local button or test-mode switch as satisfying certified-CMP requirements. The integration does not establish AdSense approval or guarantee ad fill.

The runtime supports test mode for development: set `testMode: true` to emit `data-adtest="on"`. Test requests still contact third parties and remain opt-in.

## CSP

The build generates a hash-based policy. AdSense uses scoped Google script, connect and frame origins, including `ep1.adtrafficquality.google`, `ep2.adtrafficquality.google` and `www.google.com`, observed in the live SDK chain. The configurable `frameOrigins` list must contain only reviewed HTTPS origins. Never replace these lists with a global wildcard or enable inline scripts to fix a blocked ad.

Google can inject hidden SDK bookkeeping elements; the application configures only the one homepage ad unit. Google Auto ads settings are managed in AdSense, not this repository. If enabling Auto ads separately, exclude this site/pages to retain the one-placement requirement.

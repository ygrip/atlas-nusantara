# Advertising

`config/ads.json` uses public publisher `ca-pub-5501931731194817` from trick-it and the operator-provided homepage slot `5292790825`. The operator requested `testMode: false`: live requests omit the `data-adtest` attribute. The validator accepts explicit boolean modes, and disabling `enabled` prevents the placement from rendering.

The homepage has exactly one configured placement and automatically requests it once the slot has a usable layout and comes within 500 pixels of the viewport. The SDK is not requested during initial hero rendering when the placement is far below the fold. There is no load button or per-document opt-in. No-fill, blocked SDKs and network failures collapse the entire placement; a 30-second response deadline after the slot first becomes viewable also collapses a stalled placement. A legitimate below-fold ad does not expire before the visitor reaches it. The ad is never auto-refreshed. Legal links perform full navigation so Google's loaded SDK does not remain active in the Privacy Policy or Terms document. Provider no-fill and SDK/ad-blocker failures never prevent the atlas from working.

Automatic loading is the operator's explicit choice, not consent certification. Site/ad-unit approval and applicable Google or regional consent requirements remain operator responsibilities. A test-mode switch does not satisfy certified-CMP requirements. The integration does not establish AdSense approval or guarantee ad fill.

The runtime supports test mode for development: set `testMode: true` to emit `data-adtest="on"`. Test requests still contact third parties. Browser tests mock the SDK rather than generating live advertising traffic.

## CSP

The build generates a hash-based policy. AdSense uses scoped Google script, connect and frame origins, including `ep1.adtrafficquality.google`, `ep2.adtrafficquality.google` and `www.google.com`, observed in the live SDK chain. The configurable `frameOrigins` list must contain only reviewed HTTPS origins. Never replace these lists with a global wildcard or enable inline scripts to fix a blocked ad.

Google can inject hidden SDK bookkeeping elements; the application configures only the one homepage ad unit. Google Auto ads settings are managed in AdSense, not this repository. If enabling Auto ads separately, exclude this site/pages to retain the one-placement requirement.

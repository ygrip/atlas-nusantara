# Asset provenance

## Identity

`static/brand/indonesia-clay.webp` is the approved, text-free claymorphic Indonesian archipelago emblem, with red/white islands, turquoise sea, green foliage, and subtle gold/compass ornaments. It is decorative artwork, **not** a GIS coastline or administrative-boundary source. `static/brand/favicon-64.png`, `static/icon-192.png`, and `static/icon-512.png` are resized derivatives. Run `npm run generate:icons` after `npx playwright install chromium` to regenerate the PNGs from the committed WebP. The identity image was generated in ChatGPT for this project; no borrowed logo or third-party map artwork is used. `scripts/generate-og.mjs` still creates the separate Open Graph card.

## Illustrations

The clay illustrations were generated with the bundled imagegen CLI using **OpenAI gpt-image-1.5**, high quality. Square source images were 1024 × 1024; the hero was 1536 × 1024. Pillow produces responsive WebP variants at 384/640 px and hero variants at 768/1200 px. No third-party reference artwork or generated person presented as a real user is included.

| Asset | Prompt subject | Use |
|---|---|---|
| hero-archipelago | A generic tropical clay archipelago with a green volcano, rice terraces, stilt house, palms, a small weather balloon, cloud and sun | Decorative hero, explicitly not a real map |
| error-404 | Clay paper boat with a small red-white flag, compass, rolled map and distant generic islands | Missing-page recovery |
| error-500 | Small clay weather station under friendly repair, anemometer, rain gauge, wrench, gear and bandaged cloud | Runtime error recovery |
| legal | Clay scroll, shield/check, compass and small potted plant | Terms and privacy |
| offline | Sleeping clay cloud and fading connection arcs on a small island | Reserved offline illustration asset |

Shared direction: matte plasticine, rounded toy forms, soft warm studio lighting, generous margins; cream, peach, mint, lilac, sea blue and terracotta; no text, watermark or borrowed logo. The offline illustration is generated but not used as a fake live-data state.

The independent `src/error.html` fallback uses a small original inline compass/map drawing so it remains useful with JavaScript, fonts and image requests disabled. It is not used as the geographic map.

## Geographic and runtime sources

See [DATA_SOURCES.md](DATA_SOURCES.md) for BPS/OCHA geometry (CC BY 3.0 IGO), NOAA ETOPO1 relief (public domain), the MIT region transcription, and BMKG attribution/forecast limitations. AI image generation is never used for coastlines, administrative boundaries or weather data.

Notices for Nunito, Lucide, Three.js, Lenis, GSAP and the wilayah transcription are under `static/licenses/`. GSAP uses its standard no-charge license, not MIT.

## Documentation captures

`scripts/capture-screenshots.mjs` captures the real production app with Playwright. It uses static reduced-motion frames for reproducibility and verifies page errors and phone width. Public city pins in those images are demonstration preferences; no real visitor location is published.

# Asset provenance

## Identity

`static/brand/indonesia-clay.webp` is the approved, text-free claymorphic Indonesian archipelago emblem, with red/white islands, turquoise sea, green foliage, and subtle gold/compass ornaments. It is decorative artwork, **not** a GIS coastline or administrative-boundary source. All displayed identity assets are transparent PNG derivatives: `static/brand/favicon-64.png`, `static/brand/logo-256.png`, `static/icon-192.png` (also Apple touch icon), and `static/icon-512.png`. The manifest uses `purpose: "any"`, not an opaque maskable tile. Run `npm run generate:icons` after `npx playwright install chromium` to regenerate and alpha-check them from the committed WebP. The identity image was generated in ChatGPT for this project; no borrowed logo or third-party map artwork is used. `scripts/generate-og.mjs` still creates the separate Open Graph card.

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

`scripts/capture-screenshots.mjs` captures the real production app with Playwright (viewport shots, sections, and every data layer); `scripts/capture-full-page.mjs` produces the stitched full-page JPEGs. It uses static reduced-motion frames for reproducibility and verifies page errors and phone width. Public city pins in those images are demonstration preferences; no real visitor location is published.

## Full-bleed archipelago hero

- **Clay figures.** The seven cutouts in `static/illustrations/hero/` (Sumatran tiger, volcano, orangutan, flag, Komodo dragon, pinisi, cenderawasih: one per island region, the tiger standing on Sumatra) were generated with the Codex `imagegen` skill's CLI: `gpt-image-2`, medium quality, 1024 x 1024, flat `#ff00ff` key background, one prompt per figure (shared style: soft matte claymorphism, simple rounded plasticine forms, muted palette matching the island plates `#de949a #f1c2c5 #aed4b5 #efdaac #fff0cb #9d465f`, soft top-left light, no text or logos). Alpha was extracted locally with the skill's `remove_chroma_key.py` (`--auto-key border --soft-matte --despill`), then cropped, scaled to 420 px on the long edge and saved as WebP (quality 80, 9-29 KB each, about 146 KB in total). They replace the earlier fal.ai set, whose glossier, more photographic style did not match the flat island plates. The animals are decorative representations, **not evidence of species occurrence at particular coordinates**.
- **Geography.** `static/illustrations/atlas-anatomy.svg` is NOT AI-generated. It preserves all 38 paths from `static/data/geometry-2025/national.json` in their shared 1000 x 500 projection. `scripts/geo/simplify-anatomy-svg.mjs` shrinks it (Douglas-Peucker, 0.3 unit tolerance, one decimal, no per-province data attributes, specks under 0.7 unit dropped): 264 KB to 103 KB, about 36 KB gzipped, with no visible change at hero size. Boundaries: BPS / OCHA ROAP via HDX COD-AB Indonesia, **CC BY 3.0 IGO**. Illustrative, not an official cadastral or navigation map.
- **Design.** Informed by Anatomy (https://github.com/wheresryan22/anatomy, MIT) and the build-awwwards-quality-sites brief (https://github.com/MengTo/Skills): physically stacked plates (shadow, base, middle, top) at settled coordinates, one clear focal flag, calm eased motion. No code or imagery from either was copied. The map is never tilted and has no pointer parallax or hover pull-apart.
- **Layout.** One full-bleed stage fills the hero card; the headline, tagline, intro and calls to action lie over its western half on a surface-colored scrim, and the map sits on the right. On phones the copy stacks above the map. The final pose is the static first frame and works without JavaScript.
- **Motion and sound.** The map starts settled; the short copy entrance remains. After `window.load`, an idle callback loads the interaction module, CSS and seven clay pose strips; buttons enable after sprite decoding. Each figure is a keyboard-accessible button: tiger roar, orangutan wave, flag hoist/wave, volcanic smoke/lava, komodo tongue/tail, pinisi water/rocking and cendrawasih wing flap. The seven new eight-pose assets replace the clipped-body approximations; [generation prompts and processing](HERO_MOTION.md) document the approved `gpt-image-2` CLI workflow. Finite stepped transforms and opacity transitions follow [Emil Kowalski's animate skill](https://github.com/emilkowalski/skills/tree/main/skills/animate); no runtime animation dependency or idle loop is added. Audio downloads only on activation, one clip at a time; pressing the same figure again, Escape, hiding the tab or unmounting stops it. Reduced motion keeps static selection feedback and sound. [Audio credits and adaptation licenses](../static/audio/hero/CREDITS.md) cover the tiger, cartoon monkey imitations, cinematic volcano effect, real snake hiss and anthem excerpt. Only waves/chirps are synthesized offline with `node scripts/generate-hero-sfx.mjs` (requires ffmpeg). Middle/base plates retain 1.5/3-unit offsets and the shadow 5 units. No map tilt, pointer parallax or coastline modification is used.
- **Copy.** Intent-led copy in all 13 locales: tagline reuses `og_headline`; `atlas_intro`, `hero_cta_atlas` and `hero_cta_provinces` were rewritten. Machine-assisted translations of the new strings should be reviewed by native speakers.

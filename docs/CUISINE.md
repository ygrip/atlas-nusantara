# Cuisine layer

The **Cuisine** map layer lists Indonesian dishes with a short description, photos and recipes. It follows the [flora and fauna](SPECIES.md) design: static JSON only, no recipe API, no scheduled crawler. A map marker is a *province count*, never a restaurant or a cooking location.

## Published files

- `static/data/cuisine/index.json`: totals, coverage, dish-type counts and one summary per province (38). Loaded when the layer opens; draws the province markers.
- `static/data/cuisine/provinces/<code>.json`: every dish listed for one province. Loaded only when that province is selected.
- `static/data/cuisine/national.json`: the whole aggregate, including dishes with no province. **Download only**: the browser never fetches it.
- `static/data/cuisine/locales/<locale>.json` (optional): translations of each dish's first recipe, see [Translations](#translations).

The files are Workers Static Assets. The browser validates each one with `src/lib/data/cuisine-validation.js` (shared with the build script) and checks every shard against the index totals.

## Interface

- **National view:** bento metric cards (dishes, with recipes, with photos, types, provinces) and a dish-type bar.
- **Province table:** photo, name, type, recipe count with time and yield of the first recipe. Search matches dish names **and ingredients**; filters for type, "with recipe" and "with photo".
- **Row click opens a popup** (`CuisineDialog.svelte`): photo gallery (up to four photos with credit), Wikipedia summary, provinces, and every recipe as a tab with ingredients, method, author and a link to the original page.
- **Share** draws a 1080 x 1080 card (`renderDishShareCard` in `src/lib/share/card.ts`) and a link that reopens the dish (`?layer=cuisine&region=63&dish=soto-banjar`). Only Wikimedia Commons photos are drawn; the card falls back to the local illustration for Cookpad photos.
- Markers use the clay `bowl` pin (`src/lib/map/clay-pin.ts`). A dish without a photo, or whose photo fails to load, shows `static/illustrations/cuisine/dish.svg`.

## Record

`src/lib/data/cuisine-contract.ts` is the schema (version 2). Per dish: `id`, `name`, `group`, `provinceCodes`, `originStatus`, `summary` (+ `summaryLanguage`), `articleUrl`, `images` (1 to 4 compact references), `recipes` (1 to 4) and `sources`. Per recipe: `id`, `source` (`cookpad`, `lorthgyu` or `atlas`), `title`, `url` (always the attribution link), `author`, `yield`, `timeMinutes`, `ingredients` and `steps`. Recipes are ordered: reviewed Atlas recipes, then Cookpad by likes, then the MIT corpus.

## Sources and what each contributes

| Source | Used for |
|---|---|
| [Daftar masakan Indonesia](https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia) (Indonesian Wikipedia) | Dish names and *listed-with* province associations. **Not** proof of exclusive origin. |
| Indonesian Wikipedia articles (REST page summary) | The short description (CC BY-SA 4.0) and the lead photo file. |
| Wikimedia Commons file pages | Author and licence of each lead photo. Only CC0, CC BY, CC BY-SA and public domain files are kept. |
| [Cookpad Indonesia](https://cookpad.com/id) | Recipes (ingredients, steps, yield) and their photos, found by searching each dish name. |
| [LorthGyu/indonesian-recipes](https://huggingface.co/datasets/LorthGyu/indonesian-recipes) (MIT) | 159 more recipes, joined on normalized dish names only. Its broad region field is never turned into a province. |
| Four reviewed seed recipes (`scripts/recipes/seed.json`) | Rendang, Pempek, Soto Banjar and Papeda, original adaptations. |

## Image policy: references only

**Never download, store, upload, transform or bundle photographs.** A photo is a small reference (`commons`: the `upload.wikimedia.org` path and original width; `cookpad`: recipe id and image hash) and the URL is rebuilt in `src/lib/data/cuisine-images.ts`. Commons thumbnails are never requested wider than the original. The validator rejects anything that is not one of those two forms, so local, `data:` and unrelated-host paths cannot be published. A missing photo shows the local illustration.

Commons photos are read from `upload.wikimedia.org`, which sends CORS headers (the `Special:FilePath` redirect does not), so they can be drawn onto a share card. Cookpad's image host sends none: those photos are shown with credit but never drawn.

## Rebuild

Everything caches under `tmp/recipes-cache/` (ignored by Git) and the crawl stages are resumable. Run from the repository root:

```bash
node scripts/recipes/crawl-cookpad.mjs          # about 40 minutes for ~2,200 dishes; concurrency 3 and 700 ms delay by default
node scripts/recipes/fetch-wikipedia.mjs        # about 40 minutes: summaries, lead photos, Commons licences
npm run build:cuisine                           # merge, validate, write static/data/cuisine
npm test
```

`build.mjs` also fetches the Wikipedia list and the LorthGyu corpus and refuses to publish when either yields too little. It drops list entries that are not dishes (islands, regions, institutions) when their article never mentions food and no recipe was found; the last run dropped 114 of 2,278. The dish **type** (`group`) is a heuristic on the dish name, with the opening words of the summary as a second chance (`scripts/recipes/classify.mjs`): `other` means no rule matched.

The GitHub workflow `cuisine-build.yml` runs the same steps on demand only. It must not run on push, because the build rewrites the published data.

Cookpad is crawled politely: `robots.txt` allows these pages, requests carry an honest user agent, and the crawl backs off and stops after repeated 403, 429 or 5xx answers. The Commons licence is read from the file page HTML, because the Commons API answers 503 on many networks.

## Translations

The 13 interface languages come from the Paraglide catalog. Recipe text stays **Indonesian** until translated; the dialog says so. An optional offline script translates each dish's first recipe:

```bash
OPENAI_API_KEY=... OPENAI_TRANSLATE_MODEL=... npm run translate:cuisine -- --locale th
```

It is a developer step only (the browser never calls a model), validates line counts, resumes from checkpoints and marks output `machine-unreviewed`. It has **not** been run. With 1,300+ recipes it is a large job per locale; review ingredient units and temperatures, especially for Khmer, Lao, Burmese, Tamil and Tetum.

## Limits to keep in mind

- **Provinces are associations.** A dish appears where Wikipedia's list names it. A dish absent from a province may simply not be listed there. 101 dishes (from the MIT corpus) have no province and appear only in `national.json`.
- **A missing recipe or photo does not mean a dish does not exist.** Many local dishes have no Cookpad recipe or Wikipedia article.
- **Summaries** are the opening of the Wikipedia article the list links to. Some links are redirects, so a name and its summary can describe a close variant.
- **Recipes are written by Cookpad users and keep their copyright.** The atlas shows each recipe with the author and a link to the original page, but republishing the national file commercially needs its own review of Cookpad's terms. Recipes are informational: food safety, allergies and quantities still need a human check.
- **Type** and **photos** are not curated. The interface strings for the new keys were machine-translated; Khmer, Lao, Burmese, Tamil and Tetum need native review.

## Regional supplementary sources

The Wikipedia cuisine list omits dishes from several provinces. The curated `scripts/recipes/regional-supplements.json` adds documented associations for Bangka Belitung (19), East Kalimantan (64), West Papua (92), South Papua (93), Central Papua (94), Highland Papua (95), and Southwest Papua (96). Each row includes a named food, province code, short Indonesian description and supporting regional-tourism URL. A province association is **not** evidence of exclusive origin, especially after the 2022 Papuan province split.

The offline builder merges these entries after Wikipedia, recipes and seeds; normalized dish names are deduplicated so papeda stays one national dish with multiple province associations. A documented regional entry without a recipe/photo remains valid, and the UI uses the existing placeholder. No synthetic recipes, unauthorized photo copies or unverified origin claims are introduced. The builder retains these associations on subsequent rebuilds.

After editing the supplement, regenerate snapshots with `npm run build:cuisine` (internet required), run `npm test`, and commit `static/data/cuisine/index.json`, `national.json` and all affected province shards together. Until a regeneration is committed, existing published province counts remain unchanged.

### Local regional enrichment

The supplement contains **32 distinct dish names and 43 province associations**. The `reviewStatus` field distinguishes `source-backed` from `needs-source-review`. Some shared Papuan dishes require more specific location evidence; the marker is preserved in published dish sources as `association-pending-review`, not misrepresented as a verified origin.

From the repository root (Node 22+):

```bash
# 1. Optional: enrich just the 32 new/updated names before rebuilding.
node scripts/recipes/crawl-cookpad.mjs --regional-only --concurrency=2 --delay-ms=1200
node scripts/recipes/fetch-wikipedia.mjs --regional-only --concurrency=2 --delay-ms=800

# 2. Build all published JSON from source and caches.
npm run build:cuisine

# 3. Validate schema, counts and project checks.
npm test
npm run check
```

The Cookpad stage extracts recipe JSON-LD from public results, caches author attribution and ingredient/step fields, and stops after repeated blocks. The Wikipedia stage only processes supplemental entries with a known `articleUrl`; it accepts only Commons image metadata with compatible open licences. Neither script fabricates recipes or fetches images from Google Images. Review URLs, spelling and local attribution before treating `needs-source-review` records as verified. Re-running is resumable from `tmp/recipes-cache`.

### Cookpad-first images

For regional dishes, the Cookpad crawl fetches each matching recipe page and reads its schema.org `Recipe` JSON-LD, including the recipe author's photo URL. `assembleDish` places photos sourced from accepted Cookpad recipes before any Wikimedia fallback, retaining the recipe author's credit and a link to the original recipe. The image reference is stored in the dataset; **Cookpad photos are not downloaded or copied into the repository**. Cookpad images are used only for display, never canvas share-card rendering, because they are not assumed openly licensed and the image origin lacks the necessary CORS headers. Recipes similarly retain original author and page attribution.

```bash
node scripts/recipes/crawl-cookpad.mjs --regional-only --concurrency=2 --delay-ms=1200
npm run build:cuisine
npm run check:cuisine-coverage
```

If Cookpad blocks a request or returns no matching recipe, no recipe/image is invented; the existing illustration fallback remains. The crawler can resume from its on-disk cache. Verify that hotlinking complies with Cookpad terms before deploying at scale.

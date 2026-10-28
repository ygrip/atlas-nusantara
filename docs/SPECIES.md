# Flora and fauna layers

Two map layers, **Flora** and **Fauna**, list the plant and animal species recorded in Indonesia with their common and Latin names, IUCN status, habitat, a short description and a photo. They follow the [destinations](DESTINATIONS.md) design: static JSON only, no species API, no scheduled crawler.

## Published files

For each kind (`flora`, `fauna`):

- `static/data/<kind>/index.json`: totals, coverage, status and group counts, and one summary per province (38). Loaded when the layer opens; draws the province markers.
- `static/data/<kind>/provinces/<code>.json`: every species recorded in one province. Loaded only when that province is selected.
- `static/data/<kind>/national.json`: the whole Indonesia aggregate, including species with no province. **Download only**: the browser never fetches it; the panel offers it under "Source coverage".

The files are Workers Static Assets like the rest of `static/`. Every file is far below the 25 MiB per-file limit. The browser validates each file with `src/lib/data/species-validation.js` (shared with the build script) and checks the shard against the index totals.

## Interface

- **National view:** bento metric cards (total, threatened, protected, groups, provinces), an IUCN status bar and group chips.
- **Province table:** photo, name, Latin name, status, habitat. No description column. Species without a photo, or whose photo fails to load, show the local illustration `static/illustrations/species/{flora,fauna}.svg`.
- **Row click opens a popup** (`SpeciesDialog.svelte`): photo gallery (up to four iNaturalist photos with credit and licence), IUCN status, protection, description, habitat, provinces and sources.
- **Share** in the popup draws a 1080 x 1080 canvas card (`renderSpeciesShareCard` in `src/lib/share/card.ts`) with photo, names, status and description, and a link that reopens the species (`?layer=fauna&region=11&species=<gbifKey>`). Only openly licensed photos are drawn: they come from iNaturalist's open-data bucket, which allows canvas reads. All-rights-reserved photos are shown in the popup but the card uses the illustration instead.
- Markers use clay `leaf` and `paw` pin symbols (`src/lib/map/clay-pin.ts`).
- Downloads (national and province) and the source-coverage panel sit under the table.

Photos are requested with `crossorigin="anonymous"` when openly licensed. A browser that cached a plain response would otherwise refuse the same URL for the share canvas.

## Record

`src/lib/data/species-contract.ts` is the schema. Per species: GBIF `id`, `scientificName`, `name` (Indonesian or local), `nameEn`, `aliases`, `group`, `family`, `status` (IUCN code, `NE` when no source gave one), `protected` (on a KSDAE protected list), `cites`, `realms` (marine / freshwater / terrestrial), `habitat`, `summary` (+ `summaryLanguage`), `provinces` (atlas codes), `images` (1 to 4 compact entries `{ id, ext, credit, license }`; URLs are rebuilt by `species-images.ts`), `wikipediaUrl`, `records` (GBIF occurrence count) and `sources`.

## Sources and what each contributes

| Source | Used for |
|---|---|
| `SC_indonesia.tar.gz` (Encyclopedia of Life species checklist built from a GBIF download, DOI 10.15468/dl.vd2ajk) | The species backbone: every Animalia and Plantae species. Fungi, bacteria and other kingdoms are skipped. |
| GBIF API | Provinces (occurrence facets by GADM level 1; Papua and Papua Barat by level 2 district), IUCN category, realm flags, lineage of added species. |
| KSDAE protected flora and fauna lists | Local names, `protected` flag, CITES appendix, IUCN where given. |
| iNaturalist (place 6966, Indonesia) | Indonesian and English common names, IUCN status, photo, Wikipedia summary. |
| Animal World Map (93 mammals) | Habitat and description for those mammals, IUCN category. |
| earthsendangered.com (Indonesia list) | Listing status text and alternative names. Only facts are kept; its Wikipedia-derived article text is not copied. |

Status priority: GBIF IUCN, iNaturalist IUCN, KSDAE, Animal World Map, then the earthsendangered listing.

## Rebuild

All steps cache under `tmp/species-cache/` (ignored by Git) and are resumable. Run from the repository root:

```bash
node scripts/species/build-backbone.mjs [path/to/SC_indonesia.tar.gz]
node scripts/species/fetch-gbif-provinces.mjs     # ~3 min
node scripts/species/fetch-ksdae.mjs
node scripts/species/fetch-awm.mjs
node scripts/species/fetch-earthsendangered.mjs   # ~1,500 profile pages, ~30 min
node scripts/species/fetch-inat.mjs               # first run lists observed species (~10 min)
node scripts/species/resolve-names.mjs            # GBIF name matching for synonyms; adds species the checklist lacks
node scripts/species/fetch-inat.mjs               # second run matches names and fetches summaries
node scripts/species/fetch-gbif-species.mjs       # IUCN + realms per species, ~1 hour
npm run species:build                             # merge, validate and write static/data/{flora,fauna}
npm test
```

`scripts/species/add-messages.py` and `add-messages-2.py` added the 53 message keys once; they are kept for reference and must not be rerun.

## Limits to keep in mind

- **A species is listed where it was recorded.** Provinces come from GBIF occurrence points (GADM 2018 boundaries). A species absent from a province may simply not be recorded there; marine records outside provincial polygons have no province and appear only in `national.json`. Papua provinces are placed by the district named in each record (names matched to the 2025 atlas), not by coordinates.
- **Status `NE`** means no source supplied an IUCN category, not that the species is safe. Common names and photos exist mostly for species iNaturalist has observed; many insects, algae, and marine invertebrates have only a Latin name.
- **Photos are hotlinked** from iNaturalist (`static.inaturalist.org`) with credit and licence text. Most are all-rights-reserved or CC BY-NC; they are not copied into the repository or the national download. Review iNaturalist's terms before adding ads or paid features, as with PetaBencana in the [overlay docs](OVERLAYS.md).
- **Descriptions** are the first sentences of Wikipedia (via iNaturalist) in Indonesian, falling back to English, or short excerpts from Animal World Map. Check each source's licence before republishing the national file commercially.
- Names in 13 locales: the new interface strings were machine-translated; Khmer, Lao, Burmese, Tamil, Tetum and Thai need native review.
- The flora and fauna layers are not exhaustive census data. They cover what the cited sources hold.

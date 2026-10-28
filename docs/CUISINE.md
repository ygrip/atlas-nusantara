# Indonesian cuisine catalogue

The Cuisine layer uses static JSON at `static/data/cuisine/catalog.json`. It is not a live scraper, and it does not fetch external APIs when visitors open the atlas.

## Sources and aggregation

- **Dish index:** [Daftar masakan Indonesia](https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia). The importer collects named foods under recognized province headings. A mention does **not** establish exclusive origin or where a recipe was invented. Multiple province mentions remain multiple codes.
- **Recipes:** [LorthGyu/indonesian-recipes](https://huggingface.co/datasets/LorthGyu/indonesian-recipes), dataset card states MIT. The publisher requests both `data/train.jsonl` and `data/val.jsonl`; it requires hundreds of valid records before replacing the current snapshot. Ingredients and instructions are taken from that dataset, not invented from Wikipedia names. Match exact normalized titles first; a unique multi-word indexed base title can match a longer recipe variant. Unknown matches retain an empty province list.
- **Images:** Only exact article page-image candidates from Indonesian Wikipedia, cross-checked against Wikimedia Commons file metadata. Supported CC/Public Domain licenses must pass `isReusablePhotoMetadata()`, including a description link, author/credit, license, canonical license link, and review timestamp. This is automated metadata validation, **not** human image subject verification. Missing or disputed images stay placeholders.

The Wikimedia list is CC BY-SA; its raw prose is **not** copied into records. Recipe content has its own terms stated by the dataset author. Re-check current source terms before redistribution. The snapshot includes source URLs, and each photo carries explicit attribution.

## Build the complete snapshot

Node 22.12+ (network connectivity required for maintenance only):

```sh
npm run build:cuisine            # Wikipedia + recipe rows; up to 180 image attempts
node scripts/cuisine/build.mjs --images=0    # fast, no images
node scripts/cuisine/build.mjs --images=800  # optional larger image pass
npm run check:locales
node --test tests/geo/cuisine.test.mjs
```

Image enrichment is bounded (max 4,000 candidates) and skips missing or incompatible licenses. Each failed source fetch fails publication rather than writing a misleading empty catalogue. The checked-in starter snapshot may contain a small independently written demonstration set until the import succeeds; its caution field identifies it. The feature branch includes a one-time workflow to generate and commit the full snapshot and then uses the normal PR CI.

## Thirteen languages

UI messages use **Paraglide JS**, exactly the existing locales:
`en, id, ms, fil, th, vi, my, km, lo, zh-SG, ta, tet, pt-TL`.

**Ingredient and method translations are separate from UI translations.** Imported recipes remain Indonesian by default. If translations aren't present, the interface openly labels the Indonesian fallback rather than falsely claiming localized recipe content. The importer can preserve manually supplied translations from `data/cuisine/translations.json`:

```json
{
  "rendang": {
    "en": {
      "name": "Rendang",
      "ingredients": ["...same number and order as Indonesian source..."],
      "steps": ["...same number and order as Indonesian source..."],
      "status": "machine-unreviewed"
    }
  }
}
```

Set status to `reviewed` **only after human language review**. Steps and ingredient counts must match the source; otherwise the localized record is ignored. This contract supports all 13 locales but is not a claim that every recipe has been fully translated.

## Map behavior

Choose Cuisine from the layer picker. Province selection on the shared map filters entries by Wikipedia province mentions; the national view shows all collected dishes. A dish with no defensible province match remains discoverable nationally, without invented coordinates. Filter by recipe availability, search names or ingredients, open cooking instructions, and view photo credits. Catalogue downloads require no API or Worker.

## Caveats

- A cuisine atlas is not a verified register of culinary origins. Province lists can disagree with other sources.
- A listed dish is **not** assumed to have cooking instructions.
- Dataset instructions have not been cooked, taste-tested, or medically/allergen-checked. Food safety matters, particularly with raw protein and seafood.
- Commons filenames and article lead photos can be misleading. Attribution validation does not guarantee semantic identity.
- No complete 13-language recipe corpus is asserted until all ingredient and step translations are generated and reviewed.

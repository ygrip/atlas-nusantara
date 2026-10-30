# Atlas Nusantara editorial continuation

## Implementation status: 13-language drafts; release review pending

This branch now contains an About page with key features, technical background, limitations and FAQs, a guide index, and three original guides about administrative geography, dated weather/earthquake/disaster data, and biodiversity/cuisine/destinations. The content is in 13 Paraglide message dictionaries under `editorial_*`; no separate English-only JSON content loader remains. Do not claim human translation validation or AdSense approval.

The new pages use the existing URL locale routing. `svelte.config.js` registers all prefixed editorial routes; `scripts/prepare-static.mjs` produces canonical, `hreflang`, locale metadata, JSON-LD and sitemap records. `scripts/check-editorial-build.mjs` validates their generated HTML, and `tests/i18n/editorial.test.mjs` checks locale completeness. The legacy borrowed article schema and arbitrary word-count gates were removed.

## Before merge/deployment

1. Run `npm run check:locales`, `npm run check`, `npm test`, and `npm run build` on the current branch, then review the GitHub workflow conclusion and any failures. Build validation checks 65 editorial pages across all 13 languages.
2. Manually inspect mobile and desktop renders, tab navigation, SvelteKit route transitions and locale switching for About, Guides and guide details. Check that no unlocalized labels, duplicated metadata or broken links survive in the final HTML.
3. Arrange native-speaker review for all twelve translations from English. In particular, verify geographical terminology and that safety caveats never imply live alerts, reliable negative results or complete coverage.
4. Reconcile claims against `README.md`, `docs/DATA_SOURCES.md`, `docs/GEOMETRY.md`, `docs/SPECIES.md`, `docs/CUISINE.md`, and `docs/DESTINATIONS.md`. External repository source documentation is in English.
5. Check advertising consent, indexing and current Google guidance independently. Translations alone do not constitute duplicate or low-value content, and there is no universal word-count requirement. AdSense approval is not guaranteed.

Do not commit secrets, personal tax details, generated datasets, or unrelated local `tmp/` material.

# Atlas Nusantara editorial continuation

## Implementation status: 13-language drafts; release review pending

This branch now contains an About page with key features, technical background, limitations, maintainer transparency and FAQs, a guide index, and three source-aware guides about administrative geography, dated weather/earthquake/disaster data, and biodiversity/cuisine/destinations. The content is in 13 Paraglide message dictionaries under `editorial_*`; no separate English-only JSON content loader remains. Do not claim human translation validation or AdSense approval.

The articles now add **localized hands-on examples**: Aceh's administrative directory compared against older boundary geometry; the distinction between BMKG timestamped data and simulated weather visuals; and the differences between species occurrences, conservation/legal status, recipe provenance and photo attribution. These are original reading instructions grounded in Atlas Nusantara's implementation, not republished provider copy or artificial word-count padding.

Five lightweight, custom local SVG illustrations (`static/illustrations/editorial-*.svg`) reflect the project's red/white, green and golden claymorphic art direction. The images are decorative, intentionally not representations of surveyed boundaries, observed disasters or official maps. They are shared across locales and carry empty alternative text.

All five editorial page types have visible, localized breadcrumbs. The static builder emits a separate `BreadcrumbList` JSON-LD block with the same hierarchy, translated names and canonical URLs. The HTML validator verifies both structured data and matching visible links; source-level unit tests check all locale keys and illustration assets.

The Privacy and Terms pages no longer insert English-only sections into non-English pages. Ad placement and disclosure describe the actual current behavior: only the English homepage can request the one configured AdSense slot. The four locales not supported by Google publisher policy (`my`, `km`, `lo`, `tet`) remain accessible without ad requests; the rest also have no ad slots outside English. Do not change this restriction without verifying Google's current supported-language policy. The app **does not yet implement a certified consent management platform (CMP)**. Its data protection, cookie/consent, licensing and ownership disclosures still need an appropriate compliance review before monetization. A disclosure is not a substitute for consent where consent is legally required.

The new pages use the existing URL locale routing. `svelte.config.js` registers all prefixed editorial routes; `scripts/prepare-static.mjs` produces canonical, `hreflang`, locale metadata, JSON-LD and sitemap records. `scripts/check-editorial-build.mjs` validates their generated HTML, and `tests/i18n/editorial.test.mjs` checks locale completeness. The legacy borrowed article schema and arbitrary word-count gates were removed.

## Before merge/deployment

1. Run `npm run check:locales`, `npm run check`, `npm test`, and `npm run build` on the current branch, then review the GitHub workflow conclusion and any failures. Build validation checks 65 editorial pages across all 13 languages.
2. Manually inspect mobile and desktop renders, tab navigation, SvelteKit route transitions and locale switching for About, Guides and guide details. Check that no unlocalized labels, duplicated metadata or broken links survive in the final HTML.
3. Arrange native-speaker review for all twelve translations from English. In particular, verify geographical terminology and that safety caveats never imply live alerts, reliable negative results or complete coverage.
4. Review illustration contrast and legibility in light/dark mode, and test JSON-LD using Google's Rich Results Test after deployment. Confirm the visible and structured breadcrumbs agree, and that each link resolves to the correct translated URL. Reconcile claims against `README.md`, `docs/DATA_SOURCES.md`, `docs/GEOMETRY.md`, `docs/SPECIES.md`, `docs/CUISINE.md`, and `docs/DESTINATIONS.md`. External repository source documentation is in English.
5. Check advertising consent, unsupported-language exclusion, indexing, image/licence provenance and current Google guidance independently. Translations alone do not constitute duplicate or low-value content, and there is no universal word-count requirement. AdSense approval is not guaranteed.

Do not commit secrets, personal tax details, generated datasets, or unrelated local `tmp/` material.

## Guidance applied

- [Google: Make sure your site's pages are ready for AdSense](https://support.google.com/adsense/answer/7299563): original, useful information and navigable content, not a universal minimum word count.
- [Google: Publisher-supported languages](https://support.google.com/adsense/answer/9727): no Google ad code on pages primarily in unsupported languages.
- [Google Search: Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb): real, user-visible hierarchy and correctly ordered `ListItem` entries.

This improves readiness but **cannot guarantee AdSense approval**: Google reviews the deployed site as a whole, not just these pages. Independent sources, current data availability, legal requirements and functional usability remain relevant.

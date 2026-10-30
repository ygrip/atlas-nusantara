# Continuation: Atlas Nusantara editorial pages

## Status: unfinished; do not merge or deploy

The user wants useful, indexable pages on `nusantara.readynaz.com`: guides, an about page, key features, a technical reference, and an FAQ. This branch preserves incomplete scaffolding, not finished content or a verified build. AdSense approval is Google's decision and cannot be guaranteed.

## Resume

1. Review repository instructions, this branch, current `main`, and existing local changes. Read `README.md`, `docs/DATA_SOURCES.md`, `docs/GEOMETRY.md`, `docs/SPECIES.md`, `docs/CUISINE.md`, `docs/DESTINATIONS.md`, and relevant implementation before writing. Resolve conflicting or outdated documentation against shipped data and code; cite sources.
2. Complete the about page with what the atlas actually offers, key features, a technical reference, a worked example, limitations, and useful FAQs. `src/routes/about/+page.ts` currently expects missing `content/about.json`; the page cannot be considered complete until the data exists and is validated. Do not invent author, review dates, coverage, functionality, privacy claims, or data freshness.
3. Write original, source-backed guides explaining how to use and interpret atlas layers: administrative geography and editions; weather and earthquake snapshots; species, cuisine, and destinations. Cover attribution, coverage and caveats, and link source documentation and public providers. The atlas is **not an emergency alert service**; snapshots are dated, not necessarily live, and absence of records is not an all-clear.
4. Finish guide index/detail routes, navigation and styles. Integrate real editorial routes with `svelte.config.js` prerender entries and `scripts/prepare-static.mjs` sitemap, canonical, title, description, social metadata, and structured data handling. Inspect built HTML for duplicate or conflicting tags. Ensure linked pages exist, markup is escaped, navigation is accessible, and layouts work on mobile. FAQ schema is optional and must match visible content.
5. Review locale handling and advertising against current official Google documentation. Translation alone is not duplicate or low-value content; keep useful translations indexable unless evidence and user approval justify a change. The current branch restricts an ad slot to English but does not implement a complete indexing policy; reassess this change before deployment. Verify applicable consent and ad placement; test with mocked ad scripts, not live ad clicks.
6. Run `npm run check:locales`, `npm run check`, `npm test`, `npm run build`, and relevant browser tests; record actual exit codes. Verify prerendered pages and sitemap, then review the full diff and CI. Deploy only after review and verify public artifacts. Google does not require a specific word count or a mandatory waiting period after sitemap submission; do not add filler or promise approval.

## Known draft issues

- The proposed `src/lib/content/schema.js` and `types.ts` were copied from another project; simplify them to atlas requirements, remove arbitrary word-count gates, and avoid retaining unused tool-specific fields.
- The draft editorial layout attributes content to a named author and uses dates without verified authorship or publication evidence; correct this before use.
- The current scaffolding has no completed editorial JSON or guide content, and no tested static-site or sitemap integration. Existing homepage and footer changes are also unverified.
- Preserve unrelated untracked files, including `tmp/`; do not commit generated data, credentials, or personal tax identifiers.

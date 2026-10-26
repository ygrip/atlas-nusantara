# Destinations layer

The destinations overlay is a tourism discovery layer, **not a list of every Indonesian landmark**. The initial hand-curated edition provides two representative attractions, one natural and one human-made, in each of the 38 administrative provinces. There are 76 entries. The Kemenpar [official tourism directory](https://www.direktoripariwisata.id/peta) lists many thousands of attractions, so the starter set is deliberately labelled non-exhaustive.

The checked-in catalog is `static/data/destinations/v1.json`. Entries have a stable ID, a 2025 province code, a name and `natural` / `built` classification. Optional future importer fields include verified longitude/latitude, a Wikimedia Commons file title, and a source URL. No individual landmark coordinates have been invented.

For speed on mobile, the atlas draws at most two **province summary pins** (natural and human-made) per province, projected from each province's atlas geometry. These markers are not assertions about exact landmark locations. Clicking a pin or a province opens its gallery with category filters and text search.

Gallery imagery is requested only when a card is near the viewport. A bounded Wikimedia Commons image search uses the exact landmark name. Only matched file titles with a HTTPS Commons description page are displayed, with links to original license information. Missing, timed-out or invalid results fall back to a visual placeholder. No third-party image files are committed, and Commons photos must not be attributed to Kemenpar.

## Full-coverage follow-up

A real nationwide catalog needs an auditable ingest pipeline, not a claim that 76 records represent every attraction:

1. Validate licensing and automated-access terms for the [Sisparnas geospatial dataset](https://data.go.id/dataset/dataset/dtw) and [Kemenpar geoportal](https://geoportal.kemenpar.go.id/) before ingesting.
2. Where permitted, cross-check OpenStreetMap tourism and heritage features, including ways/relations and points. Attribute © OpenStreetMap contributors and record ODbL obligations if redistributing a derivative database.
3. Perform a **geometric** join to the pinned 2025 province boundaries, avoiding string-name province guesses, especially for the six Papua provinces.
4. Normalize duplicates and type taxonomy, preserve source identifiers, image credits and licenses; split published JSON into province shards if the catalog becomes large.
5. Build a reviewed snapshot offline or on a scheduled CI job, with a provenance manifest, bounded updates, image metadata and regression tests. Never make the map depend on an unbounded live Overpass request.

Source imagery via Wikimedia Commons needs license-by-file attribution. The linked file description is the authoritative record. The catalog's generic official directory link is for discovery/comparison only; it does not imply that every editorial starter entry was individually verified in Sisparnas.

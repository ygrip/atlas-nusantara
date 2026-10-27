# Tourism source and image research

Research date: 2026-10-27. Public visibility and an attribution line are not a redistribution license.

## Government destination sources

| Source | Verified discovery | Publication decision |
|---|---|---|
| [Direktori Pariwisata](https://direktoripariwisata.id/peta) | Page advertises approximately 19,881 destinations; inspected map code contains 20 preset priority destinations, not a verified nationwide export. | No verified bulk API or reuse terms. Do not treat the page counter as an imported inventory. |
| [Sisparnas](https://sisparnas.kemenpar.go.id/datapanel) | Public panel uses `POST /getdata/peta?scope=dtw`; 38 province selections and 503 district selections returned 18,596 unique destination markers. | Factual source-linked records indexed; no source license asserted and no descriptions or photographs copied. |
| [Data.go.id DTW](https://data.go.id/dataset/dataset/dtw) | Identifies the official DTW Sisparnas XLSX resource, 633,383 bytes. | Public label says “Terbuka”, but embedded metadata reports `isopen=false`, `private=true`, and `license_title=null`; permission is unresolved. Spreadsheet not downloaded. |
| [Kemenpar geoportal](https://geoportal.kemenpar.go.id/) | Public portal found. | No verified reusable export established. |

Exact DTW resource: <https://katalogdata.kemenparekraf.go.id/dataset/ce4f6e72-6d9e-4113-98c9-adc0b566278f/resource/c8fa3147-f780-4967-aca5-fff5742f7975/download/dtw-sisparnas.xlsx>.

The package ID is `ce4f6e72-6d9e-4113-98c9-adc0b566278f`; resource ID is `c8fa3147-f780-4967-aca5-fff5742f7975`. Resource metadata reports `datastore_active=true`, but a working public datastore API was not established. Obtain the data owner's redistribution terms and confirm current access before importing. A metadata conflict is not proof that reuse is forbidden or allowed.

## Image discovery

- [Wonderful Images](https://wonderfulimages.kemenpar.go.id/) exposes `GET /api/lainnya/articles?limit=1&offset=0` (single-record probe returned HTTP 200 and `total: 175`) and `/api/lainnya/provinces`. “Free download” did not establish a reuse license; do not automatically republish the photos.
- A real browser probe of Google Images for “Kawah Putih Wikimedia Commons” was redirected to Google's automated-traffic check. No Google Images results were collected or bypass attempted. Saved Google search URLs are navigation aids, not evidence of completed searches.
- [Google's image-use guidance](https://support.google.com/websearch/answer/29508?hl=en) requires checking the image license with its provider and original host. Google results and credits alone do not grant reuse rights.
- Wikimedia Commons is the image source. The full-catalog offline workflow evaluates every current destination against a bounded Wikidata registry (Indonesia country statement, Commons `P18` image, subject coordinate, and id/en names/aliases). It does not claim an exhaustive search of every Commons file. Publication is opt-in (`--publish`) and requires unambiguous exact-name/location agreement plus supported reusable Commons file-license metadata, creator/custom attribution, file revision evidence and retrieval time. Verification is explicitly automated, not human visual review. The completed run evaluated 18,596 records and published credited links for 241 records using 220 distinct images; 18,355 retain placeholders. See [the workflow and evidence policy](DESTINATIONS.md#commons-image-enrichment). Images remain on their host; the repository stores metadata only.

## Remaining coverage gap

The published tourism catalog now contains 18,596 unique SISPARNAS records across 38 provinces. The API national aggregate reports 18,982; summed district tables report 18,970; 62 of 503 district marker responses differ from their table counts. Only the first 10 mismatch examples survived the initial research output, and the manifest explicitly marks those examples incomplete. No authentication challenge or 4xx/429 was observed during that crawl; this is not a published rate-limit guarantee.

Source category filters report 5,550 natural, 3,398 artificial and 1,559 cultural entries (10,507 total), leaving 8,475 outside those aggregate filters. Individual marker records do not include a type; icons are image URLs, not reliable category codes. The catalog therefore keeps records unclassified rather than guessing their categories. Source province IDs 91/92 are reversed relative to the pinned edition; labels from the full 38-province selector are used instead. Of the 18,596 collected coordinates, 13,501 match the named province polygon; others are omitted, not silently reassigned.

The partial Direktori Pariwisata crawl is kept in scratch only. It reports 8,383 destinations, but `/browse/pg-4?cat=0` returned a welcome page instead of listings and later advertised pages returned 404. A public sitemap and province-related lists expose fewer available records. These gaps are recorded rather than replaced with invented entries. Neither an available photo nor an aggregate page count establishes complete coverage.

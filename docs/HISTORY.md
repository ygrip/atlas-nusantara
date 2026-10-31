# Historical empires layer (pre-1945)

Atlas Nusantara's **History** layer is a curated and attributable introduction to Nusantara's pre-independence political history. This is not an exhaustive national history and does not claim that every named dynasty formed part of modern Indonesia. The maritime history of Nusantara also involves present-day Malaysia, Brunei and other regions.

## What readers can do

- Select `Historical empires` in the layer picker or visit `/?layer=history`.
- Play the timeline from **400 BCE to 1944 CE**; use the year slider or step between milestones. The earliest archaeology marker is *not* presented as a kingdom.
- Inspect the **simultaneous**, not mutually exclusive, polities in each year; select one to read the associated region, sourced editorial summary, notable rulers and dated known reigns.
- Download the entire curated dataset directly in **JSON** (preserves evidence, uncertainty, period-specific circles and source URLs) or **CSV** (spreadsheet-friendly, JSON-encoded zones). Files are generated locally by the browser without a backend or personal tracking.

## Geography is a schematic heat map, not a boundary map

The circles on the map are *editorial approximations* made for an overview, not copied survey polygons. A circular centre, especially for a maritime kingdom, does **not** imply that it administered every place inside the circle. Three confidence classes are encoded:

| Class | Visual | Meaning |
| --- | --- | --- |
| `attested-centre` | More prominent | Approximate position of a historically documented centre or site, **not** a boundary |
| `approximate-core` | Intermediate | Hypothesised nearby core region |
| `contested-influence` | Subtle | Accounts of tribute, trade, campaigns, alliances or political influence, not direct annexation |

Circles may overlap. Neither a country's current provincial boundaries nor its current coastlines are used to infer medieval political jurisdiction. Do not compute territory sizes, population, percentage of modern Indonesia controlled, or modern legal claims from these zones. Approximate original city/site coordinates remain data points, and historical sites and ports may have changed locations. The **three-dimensional map is disabled for this layer** to avoid presenting modern raised administrative provinces as medieval borders.

## Historical chronology and source criticism

The data in `src/lib/data/history.ts` is **hand-edited**: each record has a stable ID, approximate start/end years, tradition, a named region, short original EN/ID narratives, named rulers (some with known dates), dated schematic zones, source URLs, and optional chronographic notes. Colonial entities are explicitly marked separately and are not grouped with dynasties.

The 2019 **Kementerian Pendidikan dan Kebudayaan** volume *Kerajaan-kerajaan Nusantara dalam sejarah: Sumatera* (Agus Aris Munandar et al.) is a useful scholarly starting point for Sumatran polities: https://repositori.kemendikdasmen.go.id/23858/. Access and usage conditions of the book are **CC BY-NC 4.0**, so the book itself and its illustrations are **not bundled** in this repository.

Other independent starting points:

- General chronology: https://id.wikipedia.org/wiki/Sejarah_Nusantara (orientation only; disputed dates must be checked independently).
- Tarumanagara 5th-century inscriptions and Purnawarman: https://repositori.kemendikdasmen.go.id/26567/
- Majapahit reign of Hayam Wuruk 1350–1389: https://bintangpusnas.perpusnas.go.id/konten/BK77583/seri-sejarah-kekaisaran-dan-imperium-dunia-kerajaan-majapahit
- Sriwijaya and Kedukan Bukit inscription: https://id.wikipedia.org/wiki/Prasasti_Kedukan_Bukit
- 1928 Youth Pledge and nationalist movements: https://muspada.kemenbud.go.id/sejarah-sumpah-pemuda/
- Scholarly national reference series held by the Indonesian Ministry of Home Affairs: https://bskdnlib.kemendagri.go.id/index.php?id=1433&p=show_detail
- Original BIG historical map services, **reference only**: https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_MasaIndonesiaKlasik/MapServer. Redistribution of BIG rendered layers or the service's geometric data is **not** inferred to be permitted.

### Limitations

Some end dates and founding years are disputed, and traditional king lists may not line up with contemporary inscriptions. A missing known reign does not prove there was no king. Long polities may have periods of interruption or succession not represented in this overview. The events are **waypoints**, not a year-by-year documentary reconstruction. The 1944 cutoff excludes the establishment of the Indonesian republic in 1945; it does **not** imply that institutions that survived 1945 ceased to exist.

Editorial source-specific research notes use Indonesian and English originals. The 14-locale interface strings are provided through inlang/Paraglide, and other languages receive localized historical metadata overviews (polity, region, approximate period, and ruler names). These overviews are deliberately **not** marketed as full translations of the source-specific notes; detailed translation and historical copyediting are outstanding. Japanese currently uses existing English strings outside the newly translated History controls. **Translation QA is open**, especially for low-resource languages. The same factual historical IDs, names, dates and provenance apply across languages. Category colors track changing eras for Ternate, Tidore and Gowa–Tallo: late Islamic court titles are not retroactively imposed on earlier periods.

## Changing the dataset

1. Add one record with `id`, `name`, `from`, `to`, `summary.en`, `summary.id`, `rulers`, `zones`, and at least one **record-specific** verifiable source URL.
2. Prefer datable inscriptions, archaeological publications, critical scholarly history, museum catalogue entries and official institution reports. Use encyclopedias as navigation aids. Cite which assertions each source supports; do not guess a precise historic border.
3. If a date is disputed, add a `dateNote`; preserve competing chronologies rather than silently conflating royal lineages.
4. Place documented centres only; for uncertain influence, use `contested-influence` and date-bound it. Do not infer extent from present-day provinces or automatically enlarge an empire based on a literary list of tributaries.
5. Run `npm run check:locales`, `npm run check`, `npm test`, and `npm run build`. The history tests are under `tests/geo/history.test.mjs`.
6. Publish new or corrected historical information only after provenance and translation review.

## Architecture & performance

- Data is a lightweight local ESM catalog imported only by the dynamically loaded History panel and by the selected map layer. No remote history backend, cloud databases, animation dependencies, video media or extra paid services are required.
- The historical overlay renders blended SVG circles projected through the same atlas projection as other markers; it is visually different from the current province choropleth and is accessible as a textual ruler/period list outside the SVG.
- Playback stops when the tab is hidden. Users can scrub directly or jump to milestones. Browser reduced-motion settings are respected by existing map controls.
- The **current** animated history displays one editorial heat-map approximation for each active polity, not a reconstructed annual historical border. Do not market it as an exact territorial animation.

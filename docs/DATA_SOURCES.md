# Sources, editions and limitations

## Administrative directory

The shipped directory contains **38 provinces, 416 regencies and 98 cities**.

- Upstream: [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah), MIT; pinned `db/wilayah.sql` at commit `d68e8d5516`.
- Download: https://raw.githubusercontent.com/cahyadsn/wilayah/d68e8d5516/db/wilayah.sql
- SHA-256: `c4c3396d9380d4edee072af1d9dff83573b574d7cd00a6562cf82e200e954031`.
- The upstream README advertises Kepmendagri **300.2.2-2430/2025**, while the SQL header still says **300.2.2-2138/2025**. The app uses the pinned transcription and records that discrepancy; it does not claim a line-by-line certification against the final government decision.
- Full transcription counts: 38 provinces, 514 cities/regencies, 7,285 districts and 83,762 villages/kelurahan. The app ships only the province/city directory and a representative-village forecast registry. CI can export the full hierarchy.

The maintainer explicitly chose the 2025 migration. The previous 37-province 2022 directory is no longer the runtime join target. Six former Papua Barat city codes have explicit saved-pin/deep-link upgrades. Existing D1 installations must rerun the seed deliberately; it upserts 552 current rows and removes the six obsolete 2022 city rows without changing historical observation payloads.

## Boundaries and relief

**COD-AB Indonesia v01**, valid 2020-04-01: BPS / OCHA ROAP, via [HDX](https://data.humdata.org/dataset/cod-ab-idn), **CC BY 3.0 IGO**. The ADM2 layer has 522 source units: 514 administrative units plus eight water/forest units. A one-to-one name/alias crosswalk within province groups maps the 514 administrative units to current codes. Province outlines are dissolved from these mapped units, including the six Papua provinces.

BPS codes are NOT Kemendagri codes. Direct numeric joins would misidentify many regions. The checked-in crosswalk documents every source identity and excluded non-administrative unit. Names are only a build-time candidate-matching mechanism with uniqueness/completeness checks, not a runtime geographic join or a legal certification.

**ETOPO1**, NOAA NCEI: public-domain global relief grid, 1 arc-minute resolution, obtained from NOAA CoastWatch ERDDAP. It is reprojected onto the map plane and supplies terrain and seabed depth. The local sampled grid spans roughly −9,633 to +4,410 metres; a grid-cell maximum is not a surveyed summit elevation.

Coastlines are source-derived and simplified, not fabricated tiles. They are not a “100% exact” cadastral replica: source vintage, simplification, raster resolution and vertical exaggeration remain visible limitations. See [GEOMETRY.md](GEOMETRY.md).

## BMKG forecasts

Documentation: https://data.bmkg.go.id/prakiraan-cuaca/

API: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=…`

BMKG’s documentation still cites the 2022 decision. The current API recognizes province 96 but uses older suffixes for several regencies. These mappings were checked against returned `adm2` and `kotkab`, not assumed:

| Atlas code | BMKG code | Regency | Captured village code |
|---|---|---|---|
| 96.02 | 96.04 | Sorong Selatan | 96.04.01.2004 |
| 96.03 | 96.05 | Raja Ampat | 96.05.01.2001 |
| 96.04 | 96.09 | Tambrauw | 96.09.01.2001 |
| 96.05 | 96.10 | Maybrat | 96.10.01.2001 |

`scripts/geo/build-forecast-points.mjs` makes the representative-point registry reproducible. The capture script verifies provider code/name pairs and spaces requests by at least 1.1 seconds. Attribution to BMKG is mandatory.

The committed capture has **514/514 representative points**. A spatial check places 501 within their assigned simplified 2020 boundary; 13 coastal/island samples lie outside, roughly 0.04–15.57 km from the nearest boundary edge. Source centroid definitions, omitted small islands, simplification and vintage can differ. Those coordinates are retained as provided, not moved or treated as cadastral proof. These are village-level forecasts, not complete observations at every coordinate. Province cards identify their sample location; device cards identify the nearest sample and distance. Snapshot validity and retrieval timestamps remain in the asset. Wind interpolation, cloud textures and wave motion are visualization models, not an operational numerical weather or marine forecast.

## Earthquakes, warnings and unavailable layers

- The checked-in BMKG M5+ archive contains **15 dated earthquake observations** with actual epicentre coordinates, magnitude and depth. It is not every earthquake and does not predict future events.
- Current BMKG CAP warnings belong to the separately gated publication pipeline. They are withheld if unavailable, expired or incomplete; saved earthquake/forecast assets do not bypass that policy.
- BNPB disaster history and InaRISK hazards are **not connected**. No incident count, hazard category or zero-risk claim is fabricated. Their controls explain the absence and link to the official sources.
- Other catalog links, including WorldPop, are references rather than activated feeds.

Public availability is not a blanket redistribution license. Scheduled production sources still require dataset-specific approval and deployment configuration. Refer to provider terms, retain attribution, and review changes before refreshing assets.

## Disasters and hazards

Collected by the [hazard pipeline](HAZARD_PIPELINE.md) into one dated snapshot:

- **BNPB DIBI** incident table, `https://gis.bnpb.go.id/databencana/tabel/pencarian.php`: official, preliminary event records with regency codes and impact counts.
- **PetaBencana.id** `https://data.petabencana.id/reports`, docs <https://docs.petabencana.id/general/jenis-bencana>: unverified citizen reports of six disaster types. CC BY-NC 4.0.
- **ANTARA News** RSS (`warta-bumi`, `terkini`) and **GDELT DOC 2.0**: headlines and links only, geocoded heuristically against the 2025 directory.
- **BMKG CAP** nowcast warnings, <https://github.com/infoBMKG/data-cap>: see [BMKG_CAP.md](BMKG_CAP.md).

InaRISK hazard polygons and BNPB historical archives beyond the latest DIBI rows remain unconnected.

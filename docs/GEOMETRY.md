# Verified geometry build

No fabricated geography is shipped. The region browser contains the exact historical 37/514 code edition; polygons remain unavailable until a licensed, vintage-compatible boundary source is reviewed.

The discovered repositories `AlfianAliM/Indonesia-GeoJSON` and `chmdznr/indonesia-geojson` describe **38** provinces. A repository's code license alone does not establish ownership of its original geographic data. Neither was silently joined to this historical edition.

## Build contract

1. Obtain original ADM1 and ADM2 GeoJSON with explicit redistribution rights. Review the geographic vintage against the 2022 decision, including Papua. Preserve originals outside the public directory.
2. Supply an explicit string `properties.code` on every feature. Any crosswalk must be reviewed separately; names, positions and numeric coercion are not joins.
3. Create provenance JSON with `boundaryEdition`, `codeEdition` (`Kepmendagri 100.1.1-6117/2022`), `source`, SPDX `license`, `licenseUrl`, `reviewedBy`, `reviewedAt`, `provinceSha256` and `citySha256`. The reviewer declaration is an input, not an automated legal/vintage certification.
4. Run `npm run build:geometry -- provinces.geojson cities-directory provenance.json --province 11` for one province, or omit `--province` for a complete build. The build rejects absent rights/review/checksums, unmatched or duplicate codes, incomplete counts and invalid coordinates. Mapshaper simplifies with shape preservation; d3-geo generates SVG paths offline. Review the output visually before publication.

Each invocation stages outputs and promotes them only after all requested inputs validate; a failed checksum does not partially overwrite an earlier map. Packages are limited to 2 MB and individual paths to 200,000 characters; simplify reviewed source inputs further if needed. Single-province builds preserve other existing packages. Complete output is a national package plus 37 independently lazy-loaded province packages at `static/data/geometry-2022/`. Every package retains independent source, code and boundary editions. Browser code performs no GIS calculations. Thin SVG strokes and a searchable text alternative keep small islands accessible without per-polygon blur or WebGL.

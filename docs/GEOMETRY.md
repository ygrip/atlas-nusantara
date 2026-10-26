# Geography, relief and camera

## Shipped source-derived map

`static/data/geometry-2025/` contains a national package and 38 city/regency detail packages, with 514 administrative units in total. Every package keeps independent code and boundary editions. There is no schematic tile-map fallback.

Source geometry: [COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn), BPS / OCHA ROAP, CC BY 3.0 IGO, valid 2020-04-01. The original ADM2 archive has 522 units; eight lake/reservoir/forest units are excluded, and all 514 administrative units match exactly once through `scripts/geo/crosswalk/cod-ab-2020-to-kepmendagri-2025.json`. Official renames use an explicit alias list. This regrouping is not certification of 2025 boundary-line vintage.

One national Mercator projection is used by every province package. Detail coordinates stay where the province sits on the national map; selecting a province or city changes the camera, not the projection. Projection scale/translation are embedded so dated lon/lat point data lands on the same plane.

## Rebuild boundaries

Download the COD-AB GeoJSON ZIP resource linked from HDX and extract `idn_admin2.geojson` outside the public directory. Source SHA-256 is recorded in `scripts/geo/provenance/cod-ab-2020.json`.

```sh
node scripts/geo/prepare-cod-ab.mjs /path/to/idn_admin2.geojson /path/to/staging
npm run build:geometry -- /path/to/staging/provinces-2025.geojson /path/to/staging/cities-2025.geojson scripts/geo/provenance/cod-ab-2020.json
```

The preparation stage simplifies topology together, maps every city exactly once and dissolves provinces from mapped units. Check the emitted checksums against provenance before promotion. The build validates 38/514 identities, checksums, coordinate ranges and output budgets, stages outputs, then promotes the directory atomically. A national package is limited to 2 MB and each path to 200,000 characters.

`--province 11` rebuilds a single province while preserving other packages. A complete geometry rebuild replaces the output directory, so rebuild relief afterward.

## Rebuild relief

Download the NOAA subset (the URL is quoted because it contains brackets):

```sh
curl --fail --location 'https://upwell.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude%5B(-13):1:(8)%5D%5B(93):1:(143)%5D' --output /path/to/etopo.nc
uv run --with numpy --with scipy --with pillow python scripts/geo/build-relief.py /path/to/etopo.nc
```

The 1′ ETOPO1 grid is resampled to a 2048 × 1024 PNG on the same projected plane. Decode metres as `(R × 256 + G) / 3 − 11000`. A metadata JSON records source and units.

The terrain height field uses the boundary mask for coastlines and ETOPO1 for elevation. Relief is vertically exaggerated: 4,400 m becomes about 15 map units. Minor/major elevation contours use 250/1,000 m intervals; the sea shader also shows subtle 1,000 m bathymetric contours. Simplification and the global relief grid limit small-island and close-up accuracy. This is not a legal, survey or navigational chart.

## Interaction and weather

Three.js MapControls owns pan, wheel/pinch zoom, tilt/rotation and north reset. Buttons and keyboard (+/−, arrows, Home) are alternatives. Table and directory selection fly to province/city bounds. The visual cloud deck fades across the camera while zooming into its height range, then clears below; reduced motion skips that effect.

Weather vectors use meteorological “from” directions, converted to east/south flow. Cloud cover and rain derive from representative BMKG forecast points; particles and texture drift are time-scaled for readability. Sea colour uses bathymetry; waves/ripples/foam are wind-driven presentation models, not measured wave height or current. Cloud heights are illustrative, not satellite or sounding data.

Missing WebGL or context loss switches to the SVG view. The map and forecast playback stop continuous work offscreen/hidden; pixel ratio is capped and resources are disposed on teardown. The accessible directory and native SVG region buttons remain available.

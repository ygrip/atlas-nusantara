# Extending the atlas overlays

The base map does not know about earthquake, mountain, volcano or landmark datasets. Regional boundaries, relief, camera and selection remain shared; an overlay supplies its own point data, source, legend, colour and symbol.

## Current layers

| Layer | Renderer | Data |
|---|---|---|
| Weather | Gridded wind/cloud/rain plus wind-derived sea | Dated BMKG representative-point snapshot |
| Earthquakes | Coordinate pins + archive panel | Dated BMKG M5+ archive |
| Disaster reports (`incident`) | Coordinate pins + filterable list | Merged, cleaned events from BNPB DIBI (official), PetaBencana.id (citizen) and ANTARA/GDELT headlines (news). Diamonds official, circles citizen, triangles news; colour = disaster type |
| Weather hazards (`hazard`) | Coordinate pins + list | Dated BMKG CAP nowcast warnings, pinned at the centre of each warned area, coloured by severity (no region codes inferred) |
| Mountains | Category-coloured triangle pins in 2D/3D; details and photo fallback | BIG named mountains and A/B/C volcano classes |
| Destinations | Province summary pins + photo gallery | Non-exhaustive 76-place starter selection; see [DESTINATIONS.md](DESTINATIONS.md) |

Both layers read `static/data/observations/hazards.json`, written by the [hazard pipeline](HAZARD_PIPELINE.md) (`npm run snapshot:hazards`, CI job `hazard` every 15 minutes). Pins carry their own `color` and `symbol`. Events known only to province level are listed but not pinned. An empty snapshot is not proof of no incidents or low risk. InaRISK hazard polygons are still not connected.

**Licence caution:** PetaBencana data is CC BY-NC 4.0 (a commercial licence needs an agreement). Review before enabling ads or paid features. News items are headlines and links only. See [HAZARD_PIPELINE.md](HAZARD_PIPELINE.md#licensing-and-limits).

## Mountain atlas provenance and limits

`scripts/geo/build-mountains.mjs` pages through **both** the BIG national
atlas's `Gunung` layer (1:250,000) and BIG's classified volcano layer,
using their official ArcGIS REST features. It fails closed if the pages,
record counts or identifiers do not match, rather than silently dropping
peaks. The weekly/manual GitHub workflow writes a versioned static file to
`static/data/observations/mountains.json`. It must succeed before the
mountain layer can show data. There is no browser-side mass scrape.

* **Active · Type A**: BIG Type A volcano, *not* the current PVMBG alert level.
* **Volcanic · B/C**: BIG Type B/C, still potentially active. Never show as
  extinct or safe.
* **Other / unclassified**: a named BIG mountain without a matching classified
  volcano record. **Not proof of inactivity**.

The official atlas is a named-feature inventory at its published scale, not
a complete census of every unnamed summit in Indonesia. Photos are looked
up only when a mountain is opened, using exact-name Wikipedia page matches;
an unavailable or mismatched photo falls back to a local illustration.
Photo attribution links to the matched Wikipedia article. Do not copy
images into the repo without reviewing their separate licensing terms.
Display BIG attribution and confirm any downstream republication conditions
for the generated snapshot with the operator.

## Add a point dataset

1. Add a public, attributed JSON snapshot under `static/data/`.
2. Add its definition to `OVERLAY_DEFINITIONS` in `src/lib/map/overlays.ts`, using `renderer: 'points'` and a `snapshotUrl`.
3. Add a localized label in every messages file. Refresh screenshots and add validation tests for the source adapter.

The interface is in `src/lib/map/overlay-contract.ts`:

```ts
{
  id: 'mountains',
  color: '#789156',
  symbol: 'triangle', // 'circle' | 'triangle' | 'diamond'
  source: 'The reviewed data owner',
  sourceUrl: 'https://example.org/the-actual-reviewed-dataset',
  attribution: 'The attribution required by that dataset',
  unit: 'm',
  fetchedAt: '2026-10-26T12:00:00Z',
  legend: [{ label: 'Elevation points', color: '#789156', symbol: 'triangle' }],
  pins: [] // Populate only with real, validated source coordinates.
}
```

This is a schema example, not a shipped mountain dataset or a license assertion.

A pin contains `id`, `lon`, `lat`, `label`, optional `description` and optional numeric `value`. Coordinate ranges, timestamps, identifiers, colours, supported symbols, unique pin ids and count limits are checked before rendering. Future source adapters should also validate units, attribution and dataset-specific values.

The definition adds the toolbar control automatically. RegionAtlas cancels obsolete loads when the layer changes. The 3D renderer projects pins onto the same plane as the terrain; the SVG renderer uses the same projection and symbol contract. Pin labels/descriptions are data text, not executable markup. Local snapshot URLs are required.

The camera and table continue to use administrative selection. A mountain pin need not invent a city code; spatial/name crosswalks require separate evidence.

## Limits

The generic contract currently renders **points**, not arbitrary provider tiles, raster hazard grids, polygon choropleths or executable plugins. Those require a dedicated typed renderer and source adapter. Do not treat a hazard classification as a warning or render a stale warning as current.

Earthquakes are normalized by `earthquakeOverlay()`; their original event time, magnitude, depth and coordinates remain separate from region counts. Weather uses its own field renderer because wind vectors, cloud coverage and precipitation are not generic point badges.

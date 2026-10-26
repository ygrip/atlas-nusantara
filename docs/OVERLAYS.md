# Extending the atlas overlays

The base map does not know about earthquake, mountain, volcano or landmark datasets. Regional boundaries, relief, camera and selection remain shared; an overlay supplies its own point data, source, legend, colour and symbol.

## Current layers

| Layer | Renderer | Data |
|---|---|---|
| Weather | Gridded wind/cloud/rain plus wind-derived sea | Dated BMKG representative-point snapshot |
| Earthquakes | Coordinate pins + archive panel | Dated BMKG M5+ archive |
| Disaster history | Unavailable state | No verified provider adapter/data configured |
| Hazard maps | Unavailable state | No verified provider adapter/data configured |

Unavailable is not zero incidents or low risk. The UI links to the official sources rather than painting invented data.

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

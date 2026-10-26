import { m } from '$lib/paraglide/messages.js';
import type { GeometryPackage } from '$lib/geo/types';
import type { PointOverlay } from '$lib/map/overlay-contract';

import { validateDestinationCatalog } from './destination-contract';
import type { Landmark, DestinationCatalog, LandmarkKind } from './destination-contract';
export { validateDestinationCatalog } from './destination-contract';
export type { Landmark, DestinationCatalog, LandmarkKind } from './destination-contract';
const COLORS: Record<LandmarkKind, string> = { natural: '#238a80', built: '#b16b35' };

export async function loadDestinations(signal?: AbortSignal): Promise<DestinationCatalog> {
  const response = await fetch('/data/destinations/v1.json', { signal });
  if (!response.ok) throw new Error('Destination catalog unavailable');
  const value: unknown = await response.json();
  if (!validateDestinationCatalog(value)) throw new Error('Destination catalog failed validation');
  return value;
}

/** Markers are province-level category summaries, NOT fabricated coordinates for landmarks. */
export function destinationOverlay(geometry: GeometryPackage | undefined, catalog: DestinationCatalog, selectedProvince?: string): PointOverlay | undefined {
  if (!geometry?.projection) return undefined;
  const projection = geometry.projection;
  const counts = new Map<string, { natural: number; built: number }>();
  for (const item of catalog.landmarks) {
    const count = counts.get(item.provinceCode) ?? { natural: 0, built: 0 };
    count[item.kind]++;
    counts.set(item.provinceCode, count);
  }
  const pins: PointOverlay['pins'] = [];
  for (const region of geometry.regions) {
    if (selectedProvince && region.sourceCode !== selectedProvince) continue;
    const countsHere = counts.get(region.sourceCode);
    if (!countsHere) continue;
    for (const kind of ['natural', 'built'] as const) {
      if (!countsHere[kind]) continue;
      // Offset the two category summaries slightly so neither hides the other.
      const x = (region.bbox[0] + region.bbox[2]) / 2 + (kind === 'natural' ? -3 : 3);
      const y = (region.bbox[1] + region.bbox[3]) / 2;
      const lambda = (x - projection.translate[0]) / projection.scale;
      const mercator = (projection.translate[1] - y) / projection.scale;
      pins.push({
        id: region.sourceCode + '-' + kind, provinceCode: region.sourceCode,
        label: region.name + ' · ' + countsHere[kind] + ' ' + (kind === 'natural' ? m.destination_natural() : m.destination_built()),
        description: m.destination_click_province(),
        lon: lambda * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180 / Math.PI,
        color: COLORS[kind], symbol: kind === 'natural' ? 'circle' : 'diamond'
      });
    }
  }
  return {
    id: 'destinations', source: catalog.source, sourceUrl: catalog.sourceUrl, fetchedAt: catalog.fetchedAt,
    color: COLORS.natural, symbol: 'circle', pins,
    legend: [
      { label: m.destination_natural(), color: COLORS.natural, symbol: 'circle' },
      { label: m.destination_built(), color: COLORS.built, symbol: 'diamond' }
    ]
  };
}

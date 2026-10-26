import { m } from '$lib/paraglide/messages.js';
import type { GeometryPackage } from '$lib/geo/types';
import type { PointOverlay } from '$lib/map/overlay-contract';

export type LandmarkKind = 'natural' | 'built';
export interface Landmark {
  id: string;
  provinceCode: string;
  name: string;
  kind: LandmarkKind;
  /** Optional verified coordinates for future provider imports, never guessed from a name. */
  lon?: number;
  lat?: number;
  /** Optional Commons file title, e.g. "File:Example.jpg". */
  commonsFile?: string;
  sourceUrl?: string;
}
export interface DestinationCatalog {
  schemaVersion: 1;
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  scope: string;
  landmarks: Landmark[];
}
const COLORS: Record<LandmarkKind, string> = { natural: '#238a80', built: '#b16b35' };

export function validateDestinationCatalog(value: unknown): value is DestinationCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as DestinationCatalog;
  if (catalog.schemaVersion !== 1 || !Number.isFinite(Date.parse(catalog.fetchedAt)) || typeof catalog.source !== 'string'
    || typeof catalog.scope !== 'string' || typeof catalog.sourceUrl !== 'string'
    || !Array.isArray(catalog.landmarks) || catalog.landmarks.length > 50000) return false;
  const ids = new Set<string>();
  for (const item of catalog.landmarks) {
    if (!item || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)
      || !/^(1[1-9]|2[1]|3[1-6]|5[1-3]|6[1-5]|7[1-6]|8[1-2]|9[1-6])$/.test(item.provinceCode)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
      || !['natural', 'built'].includes(item.kind)
      || ((item.lon === undefined) !== (item.lat === undefined))
      || (item.lon !== undefined && (!Number.isFinite(item.lon) || !Number.isFinite(item.lat) || Math.abs(item.lon) > 180 || Math.abs(item.lat!) > 90))
      || (item.commonsFile !== undefined && (!/^File:[^<>]{1,220}$/.test(item.commonsFile)))
      || (item.sourceUrl !== undefined && !/^https:\/\//.test(item.sourceUrl))) return false;
    ids.add(item.id);
  }
  return true;
}

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

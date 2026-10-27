import { m } from '$lib/paraglide/messages.js';
import { assetUrl } from '$lib/pwa/assets';
import type { GeometryPackage } from '$lib/geo/types';
import type { PointOverlay } from '$lib/map/overlay-contract';
import { validateDestinationCatalog } from './destination-contract';
import { validateDestinationIndex, type DestinationIndex } from './destination-index';
import type { DestinationCatalog, LandmarkKind } from './destination-contract';
export { validateDestinationCatalog } from './destination-contract';
export type { Landmark, DestinationCatalog, LandmarkKind } from './destination-contract';
export type { DestinationIndex } from './destination-index';
const COLORS: Record<LandmarkKind, string> = { natural: '#238a80', built: '#b16b35', unknown: '#7b7f8a' };

export async function loadDestinationIndex(signal?: AbortSignal): Promise<DestinationIndex> {
  const response = await fetch(assetUrl('/data/destinations/index.json'), { signal });
  if (!response.ok) throw new Error('Destination index unavailable');
  const value: unknown = await response.json();
  if (!validateDestinationIndex(value)) throw new Error('Destination index failed validation');
  return value;
}

export async function loadDestinations(index: DestinationIndex, code: string, signal?: AbortSignal): Promise<DestinationCatalog> {
  const province = index.provinces.find(item => item.provinceCode === code);
  if (!province) throw new Error('Unknown destination province');
  const response = await fetch(assetUrl(province.shard), { signal });
  if (!response.ok) throw new Error('Destination catalog unavailable');
  const value: unknown = await response.json();
  if (!validateDestinationCatalog(value) || value.landmarks.length !== province.count
    || value.landmarks.some(item => item.provinceCode !== code)
    || value.landmarks.filter(item => item.kind === 'natural').length !== province.natural
    || value.landmarks.filter(item => item.kind === 'built').length !== province.built
    || value.landmarks.filter(item => item.kind === 'unknown').length !== (province.unknown ?? 0)) {
    throw new Error('Destination province catalog failed validation');
  }
  return value;
}

/** At most two summary markers per province, never fabricated attraction coordinates. */
export function destinationOverlay(geometry: GeometryPackage | undefined, index: DestinationIndex, selectedProvince?: string): PointOverlay | undefined {
  if (!geometry?.projection) return undefined;
  const projection = geometry.projection;
  const pins: PointOverlay['pins'] = [];
  for (const region of geometry.regions) {
    if (selectedProvince && region.sourceCode !== selectedProvince) continue;
    const summary = index.provinces.find(item => item.provinceCode === region.sourceCode);
    if (!summary) continue;
    // Unknown categories stay in the gallery. Provinces with no classified
    // records still get one neutral marker, keeping the national map <=76 pins.
    const kinds: LandmarkKind[] = ['natural', 'built'];
    if (!summary.natural && !summary.built) kinds.push('unknown');
    for (const kind of kinds) {
      const count = summary[kind] ?? 0;
      if (!count) continue;
      let offset = 3;
      let label = m.destination_built();
      let symbol: 'circle' | 'diamond' = 'diamond';
      if (kind === 'natural') {
        offset = -3;
        label = m.destination_natural();
        symbol = 'circle';
      }
      if (kind === 'unknown') {
        offset = 0;
        label = m.mountain_other();
        symbol = 'circle';
      }
      const x = (region.bbox[0] + region.bbox[2]) / 2 + offset;
      const y = (region.bbox[1] + region.bbox[3]) / 2;
      const lambda = (x - projection.translate[0]) / projection.scale;
      const mercator = (projection.translate[1] - y) / projection.scale;
      pins.push({
        id: region.sourceCode + '-' + kind, provinceCode: region.sourceCode,
        label: region.name + ' · ' + count + ' ' + label,
        description: m.destination_click_province(),
        lon: lambda * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180 / Math.PI,
        color: COLORS[kind], symbol
      });
    }
  }
  return {
    id: 'destinations', source: index.source, sourceUrl: index.sourceUrl, fetchedAt: index.fetchedAt,
    attribution: index.attribution, color: COLORS.natural, symbol: 'circle', pins,
    legend: [
      { label: m.destination_natural(), color: COLORS.natural, symbol: 'circle' },
      { label: m.destination_built(), color: COLORS.built, symbol: 'diamond' },
      { label: m.mountain_other(), color: COLORS.unknown, symbol: 'circle' }
    ]
  };
}

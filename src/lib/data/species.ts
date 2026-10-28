import { m } from '$lib/i18n/messages';
import { assetUrl } from '$lib/pwa/assets';
import type { GeometryPackage } from '$lib/geo/types';
import type { PinSymbol, PointOverlay } from '$lib/map/overlay-contract';
import { FAUNA_GROUPS as FAUNA_GROUP_IDS, FLORA_GROUPS as FLORA_GROUP_IDS, isSpeciesCatalog, isSpeciesIndex, SPECIES_STATUSES as STATUS_IDS, THREATENED_STATUSES } from './species-validation.js';
import type { FaunaGroup, FloraGroup, SpeciesCatalog, SpeciesIndex, SpeciesKind, SpeciesRecord, SpeciesStatus } from './species-contract';
export type { SpeciesCatalog, SpeciesIndex, SpeciesKind, SpeciesRecord, SpeciesStatus, SpeciesGroup, SpeciesImage } from './species-contract';
export { THREATENED_STATUSES } from './species-validation.js';

/** The validation module is plain JavaScript (the build scripts share it), so the typed id lists are declared here. */
export const FAUNA_GROUPS = FAUNA_GROUP_IDS as FaunaGroup[];
export const FLORA_GROUPS = FLORA_GROUP_IDS as FloraGroup[];
export const SPECIES_STATUSES = STATUS_IDS as SpeciesStatus[];

const KIND_COLORS: Record<SpeciesKind, string> = { flora: '#4f9a52', fauna: '#c4762f' };
const KIND_SYMBOLS: Record<SpeciesKind, PinSymbol> = { flora: 'leaf', fauna: 'paw' };

export function isSpeciesKind(layer: string): layer is SpeciesKind {
  return layer === 'flora' || layer === 'fauna';
}

export async function loadSpeciesIndex(kind: SpeciesKind, signal?: AbortSignal): Promise<SpeciesIndex> {
  const response = await fetch(assetUrl('/data/' + kind + '/index.json'), { signal });
  if (!response.ok) throw new Error('Species index unavailable');
  const value: unknown = await response.json();
  if (!isSpeciesIndex(value, kind)) throw new Error('Species index failed validation');
  return value;
}

/** One province's species, read only when that province is selected. The national file is a download, never fetched here. */
export async function loadProvinceSpecies(index: SpeciesIndex, code: string, signal?: AbortSignal): Promise<SpeciesCatalog> {
  const province = index.provinces.find(item => item.provinceCode === code);
  if (!province) throw new Error('Unknown species province');
  const response = await fetch(assetUrl(province.shard), { signal });
  if (!response.ok) throw new Error('Species catalog unavailable');
  const value: unknown = await response.json();
  if (!isSpeciesCatalog(value, index.kind) || value.provinceCode !== code || value.species.length !== province.count) {
    throw new Error('Species province catalog failed validation');
  }
  const threatened = value.species.filter((item: SpeciesRecord) => THREATENED_STATUSES.includes(item.status)).length;
  const withImage = value.species.filter((item: SpeciesRecord) => item.images).length;
  if (threatened !== province.threatened || withImage !== province.withImage) throw new Error('Species province totals disagree with the index');
  return value;
}

/** One summary marker per province, never a fabricated species coordinate. */
export function speciesOverlay(kind: SpeciesKind, geometry: GeometryPackage | undefined, index: SpeciesIndex, selectedProvince?: string): PointOverlay | undefined {
  if (!geometry?.projection) return undefined;
  const projection = geometry.projection;
  const color = KIND_COLORS[kind];
  const symbol = KIND_SYMBOLS[kind];
  const pins: PointOverlay['pins'] = [];
  for (const region of geometry.regions) {
    if (selectedProvince && region.sourceCode !== selectedProvince) continue;
    const summary = index.provinces.find(item => item.provinceCode === region.sourceCode);
    if (!summary || summary.count === 0) continue;
    const x = (region.bbox[0] + region.bbox[2]) / 2;
    const y = (region.bbox[1] + region.bbox[3]) / 2;
    const lambda = (x - projection.translate[0]) / projection.scale;
    const mercator = (projection.translate[1] - y) / projection.scale;
    pins.push({
      id: region.sourceCode + '-' + kind, provinceCode: region.sourceCode,
      label: region.name + ' · ' + m.species_count({ count: summary.count.toLocaleString() }),
      description: m.species_threatened({ count: summary.threatened.toLocaleString() }) + ' · ' + m.species_click_province(),
      lon: lambda * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180 / Math.PI,
      color, symbol
    });
  }
  const label = kind === 'flora' ? m.layer_flora() : m.layer_fauna();
  return {
    id: kind, source: index.sources[0].name, sourceUrl: index.sources[0].url, fetchedAt: index.fetchedAt,
    attribution: index.attribution, color, symbol, pins,
    legend: [{ label, color, symbol }]
  };
}

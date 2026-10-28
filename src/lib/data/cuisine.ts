import { m } from '$lib/i18n/messages';
import { assetUrl } from '$lib/pwa/assets';
import type { GeometryPackage } from '$lib/geo/types';
import type { PointOverlay } from '$lib/map/overlay-contract';
import { CUISINE_GROUPS as GROUP_IDS, isCuisineCatalog, isCuisineIndex } from './cuisine-validation.js';
import type { CuisineCatalog, CuisineDish, CuisineGroup, CuisineIndex, CuisineTranslations } from './cuisine-contract';
export type { CuisineCatalog, CuisineDish, CuisineGroup, CuisineImage, CuisineIndex, CuisineRecipe, CuisineTranslation, CuisineTranslations } from './cuisine-contract';

/** The validation module is plain JavaScript (the build scripts share it), so the typed id list is declared here. */
export const CUISINE_GROUPS = GROUP_IDS as CuisineGroup[];

const CUISINE_COLOR = '#bb7448';

export function isCuisineLayer(layer: string): boolean {
  return layer === 'cuisine';
}

export async function loadCuisineIndex(signal?: AbortSignal): Promise<CuisineIndex> {
  const response = await fetch(assetUrl('/data/cuisine/index.json'), { signal });
  if (!response.ok) throw new Error('Cuisine index unavailable');
  const value: unknown = await response.json();
  if (!isCuisineIndex(value)) throw new Error('Cuisine index failed validation');
  return value;
}

/** One province's dishes, read only when that province is selected. The national file is a download, never fetched here. */
export async function loadProvinceCuisine(index: CuisineIndex, code: string, signal?: AbortSignal): Promise<CuisineCatalog> {
  const province = index.provinces.find(item => item.provinceCode === code);
  if (!province) throw new Error('Unknown cuisine province');
  const response = await fetch(assetUrl(province.shard), { signal });
  if (!response.ok) throw new Error('Cuisine catalog unavailable');
  const value: unknown = await response.json();
  if (!isCuisineCatalog(value) || value.provinceCode !== code || value.dishes.length !== province.count) {
    throw new Error('Cuisine province catalog failed validation');
  }
  const withRecipe = value.dishes.filter((dish: CuisineDish) => dish.recipes).length;
  const withImage = value.dishes.filter((dish: CuisineDish) => dish.images).length;
  if (withRecipe !== province.withRecipe || withImage !== province.withImage) throw new Error('Cuisine province totals disagree with the index');
  return value;
}

/** Optional reviewed or machine translations of each dish's first recipe; a missing locale file just means Indonesian only. */
export async function loadCuisineTranslations(locale: string, signal?: AbortSignal): Promise<CuisineTranslations | null> {
  if (locale === 'id' || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,3})?$/.test(locale)) return null;
  const response = await fetch(assetUrl('/data/cuisine/locales/' + locale + '.json'), { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Cuisine translations unavailable');
  // Static hosting answers a missing file with the app shell (HTML, status 200); that also means "no translation yet".
  if (!response.headers.get('content-type')?.includes('json')) return null;
  const value = (await response.json()) as CuisineTranslations;
  if (!value || value.locale !== locale || !value.items || typeof value.items !== 'object') throw new Error('Cuisine locale failed validation');
  return value;
}

/** One summary marker per province, never a fabricated restaurant or cooking location. */
export function cuisineOverlay(geometry: GeometryPackage | undefined, index: CuisineIndex, selectedProvince?: string): PointOverlay | undefined {
  if (!geometry?.projection) return undefined;
  const projection = geometry.projection;
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
      id: region.sourceCode + '-cuisine', provinceCode: region.sourceCode,
      label: region.name + ' · ' + m.cuisine_count({ count: summary.count.toLocaleString() }),
      description: m.cuisine_with_recipe({ count: summary.withRecipe.toLocaleString() }) + ' · ' + m.cuisine_choose_province(),
      lon: lambda * 180 / Math.PI, lat: (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180 / Math.PI,
      color: CUISINE_COLOR, symbol: 'bowl'
    });
  }
  return {
    id: 'cuisine', source: index.sources[0].name, sourceUrl: index.sources[0].url, fetchedAt: index.fetchedAt,
    attribution: index.attribution, color: CUISINE_COLOR, symbol: 'bowl', pins,
    legend: [{ label: m.layer_cuisine(), color: CUISINE_COLOR, symbol: 'bowl' }]
  };
}

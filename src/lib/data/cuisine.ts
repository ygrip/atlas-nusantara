import { assetUrl } from '$lib/pwa/assets';
import type { GeometryPackage } from '$lib/geo/types';
import type { PointOverlay } from '$lib/map/overlays';
import { m } from '$lib/paraglide/messages.js';

export interface CuisinePhoto {
  url: string; descriptionUrl: string; credit: string; license: string; licenseUrl?: string | null;
}
export interface CuisineRecipe {
  language: string; status: string; category?: string | null; difficulty?: string | null;
  timeMinutes?: number | null; ingredients: string[]; steps: string[]; sourceUrl: string;
}
export interface CuisineItem {
  id: string; name: string; provinceCodes: string[]; originStatus: string;
  articleUrl?: string | null; recipe?: CuisineRecipe | null; image?: CuisinePhoto | null;
  broadRegion?: string | null; sources: Array<{ url: string; role: string; license?: string }>;
}
export interface CuisineProvince {
  provinceCode: string; name: string; count: number; withRecipe: number; withImage: number; shard: string;
}
export interface CuisineIndex {
  schemaVersion: number; generatedAt: string; attribution: string; sources: {wiki: string; recipes: string};
  totals: {dishes: number; withRecipe: number; withImage: number; unmapped: number};
  provinces: CuisineProvince[]; featured: CuisineItem[]; national: string; scope?: string;
}
export interface CuisineTranslation {
  name: string; ingredients: string[]; steps: string[]; status: 'machine-unreviewed' | 'human-reviewed';
}
export interface CuisineTranslations { locale: string; items: Record<string, CuisineTranslation> }

export function isCuisineItem(value: unknown): value is CuisineItem {
  if (!value || typeof value !== 'object') return false;
  const x = value as CuisineItem;
  return /^[a-z0-9-]{1,120}$/.test(x.id) && typeof x.name === 'string' && x.name.length <= 160 && x.name.length > 0
    && Array.isArray(x.provinceCodes) && x.provinceCodes.every(code=>/^\d{2}$/.test(code))
    && Array.isArray(x.sources)
    && (!x.recipe || (Array.isArray(x.recipe.ingredients) && Array.isArray(x.recipe.steps)
      && x.recipe.ingredients.every(v=>typeof v === 'string') && x.recipe.steps.every(v=>typeof v === 'string')))
    && (!x.image || (x.image.url.startsWith('https://commons.wikimedia.org/wiki/Special:FilePath/')
      || x.image.url.startsWith('https://upload.wikimedia.org/')
      || x.image.url.startsWith('https://thumb.wikimedia.org/')));
}
export function validateCuisineIndex(value: unknown): value is CuisineIndex {
  if (!value || typeof value !== 'object') return false;
  const x = value as CuisineIndex;
  return x.schemaVersion === 1 && Array.isArray(x.provinces)
    && x.provinces.length <= 38 && x.provinces.every(p=>/^\d{2}$/.test(p.provinceCode)
      && Number.isInteger(p.count) && p.count >= 0
      && p.shard === '/data/cuisine/provinces/'+p.provinceCode+'.json')
    && Array.isArray(x.featured) && x.featured.every(isCuisineItem)
    && typeof x.attribution === 'string' && x.attribution.length > 0;
}
export async function loadCuisineIndex(signal?: AbortSignal): Promise<CuisineIndex> {
  const response = await fetch(assetUrl('/data/cuisine/index.json'),{signal});
  if (!response.ok) throw Error('Cuisine index unavailable');
  const parsed: unknown = await response.json();
  if (!validateCuisineIndex(parsed)) throw Error('Invalid cuisine index');
  return parsed;
}
export async function loadCuisineProvince(index: CuisineIndex, code: string, signal?: AbortSignal): Promise<CuisineItem[]> {
  const province = index.provinces.find(p=>p.provinceCode === code);
  if (!province) return [];
  const response = await fetch(assetUrl(province.shard),{signal});
  if (!response.ok) throw Error('Cuisine province unavailable');
  const parsed: unknown = await response.json();
  const x = parsed as {schemaVersion?:number;provinceCode?:string;items?:unknown[]};
  if (!x || x.schemaVersion !== 1 || x.provinceCode !== code || !Array.isArray(x.items)
    || x.items.length !== province.count || !x.items.every(isCuisineItem)
    || x.items.some(item=>!(item as CuisineItem).provinceCodes.includes(code))) throw Error('Cuisine shard failed validation');
  return x.items as CuisineItem[];
}
export async function loadCuisineTranslations(locale: string, signal?: AbortSignal): Promise<CuisineTranslations | null> {
  if (locale === 'id' || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,3})?$/.test(locale)) return null;
  const response = await fetch(assetUrl('/data/cuisine/locales/'+locale+'.json'),{signal});
  if (response.status === 404) return null;
  if (!response.ok) throw Error('Cuisine translations unavailable');
  const parsed: unknown = await response.json();
  const x = parsed as CuisineTranslations;
  if (!x || x.locale !== locale || !x.items || typeof x.items !== 'object') throw Error('Cuisine locale failed validation');
  return x;
}
export function cuisineOverlay(geometry: GeometryPackage | undefined, index: CuisineIndex, code?: string): PointOverlay | undefined {
  if (!geometry?.projection) return undefined;
  const projection = geometry.projection;
  const pins: PointOverlay['pins'] = [];
  for (const region of geometry.regions) {
    if (code && region.sourceCode !== code) continue;
    const summary = index.provinces.find(p=>p.provinceCode === region.sourceCode);
    if (!summary || !summary.count) continue;
    // Province centroid marker for a count only. Not an invented restaurant or dish location.
    const x=(region.bbox[0]+region.bbox[2])/2;
    const y=(region.bbox[1]+region.bbox[3])/2;
    const lambda=(x-projection.translate[0])/projection.scale;
    const mercator=(projection.translate[1]-y)/projection.scale;
    pins.push({
      id:'cuisine-'+summary.provinceCode, provinceCode:summary.provinceCode, color:'#bb7448', symbol:'circle',
      lon:lambda*180/Math.PI,lat:(2*Math.atan(Math.exp(mercator))-Math.PI/2)*180/Math.PI,
      label:region.name+' · '+summary.count+' '+m.layer_cuisine(),
      description:m.cuisine_choose_province()
    });
  }
  return {id:'cuisine',source:'Wikipedia · HF Recipes · Commons',sourceUrl:index.sources.wiki,
    attribution:index.attribution,fetchedAt:index.generatedAt,color:'#bb7448',symbol:'circle',
    legend:[{label:m.layer_cuisine(),color:'#bb7448',symbol:'circle'}],pins};
}

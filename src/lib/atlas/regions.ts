import { assetUrl } from '$lib/pwa/assets';

export interface Region { code: string; name: string; parentCode?: string }
export interface RegionCollection { edition: string; regions: Region[] }

export async function loadRegions(url: string, signal?: AbortSignal): Promise<RegionCollection> {
  const response = await fetch(assetUrl(url), { signal });
  if (!response.ok) throw Error('Region data unavailable');
  const payload = await response.json();
  if (payload.edition !== 'Kepmendagri 100.1.1-6117/2022' || !Array.isArray(payload.regions)) throw Error('Wrong region edition');
  if (payload.regions.some((item: Region) => typeof item.code !== 'string' || !/^\d{2}(\.\d{2})?$/.test(item.code) || typeof item.name !== 'string')) throw Error('Invalid region data');
  return payload;
}

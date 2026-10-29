import type { GeometryPackage, SvgRegion } from '$lib/geo/types';
import { CODE_EDITION, GEOMETRY_DATA_PATH } from '$lib/atlas/edition';
import { assetUrl } from '$lib/pwa/assets';
import { islandGroupOf, type IslandGroup } from '$lib/atlas/islands';

/** All province outlines of one island group, merged into a single drawable shape. */
export interface IslandShape {
  path: string;
  bbox: [number, number, number, number];
}

export interface ProvinceShapes {
  provinces: Record<string, SvgRegion>;
  islands: Partial<Record<IslandGroup, IslandShape>>;
}

let cached: Promise<ProvinceShapes> | undefined;

function hasValidBounds(bounds: number[]): boolean {
  return bounds.length === 4 && bounds.every(Number.isFinite) && bounds[2] > bounds[0] && bounds[3] > bounds[1];
}

function mergeIslandShapes(provinces: SvgRegion[]): Partial<Record<IslandGroup, IslandShape>> {
  const islands: Partial<Record<IslandGroup, IslandShape>> = {};
  for (const province of provinces) {
    const group = islandGroupOf(province.sourceCode);
    const existing = islands[group];
    if (!existing) {
      islands[group] = { path: province.path, bbox: [...province.bbox] };
      continue;
    }
    existing.path += ' ' + province.path;
    existing.bbox = [
      Math.min(existing.bbox[0], province.bbox[0]),
      Math.min(existing.bbox[1], province.bbox[1]),
      Math.max(existing.bbox[2], province.bbox[2]),
      Math.max(existing.bbox[3], province.bbox[3])
    ];
  }
  return islands;
}

async function fetchProvinceShapes(): Promise<ProvinceShapes> {
  const response = await fetch(assetUrl(GEOMETRY_DATA_PATH + '/national.json'));
  if (!response.ok) throw new Error('Province map geometry is unavailable');
  const geometry = await response.json() as GeometryPackage;
  if (geometry.schemaVersion !== 1 || geometry.codeEdition !== CODE_EDITION || !Array.isArray(geometry.regions)) {
    throw new Error('Province map geometry has an unsupported edition or format');
  }
  const drawable = geometry.regions.filter(region => /^\d{2}$/.test(region.sourceCode) && region.path && hasValidBounds(region.bbox));
  return {
    provinces: Object.fromEntries(drawable.map(region => [region.sourceCode, region])),
    islands: mergeIslandShapes(drawable)
  };
}

/** One shared download for every component that draws province or island silhouettes. */
export function loadProvinceShapes(): Promise<ProvinceShapes> {
  if (!cached) {
    cached = fetchProvinceShapes().catch(error => {
      cached = undefined;
      throw error;
    });
  }
  return cached;
}

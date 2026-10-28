import { assetUrl } from '$lib/pwa/assets';
import { isPopulationData, type PopulationData } from './population-contract';
export { pyramidRows, yearTotals, provinceSeries, provinceYear, latestYear } from './population-contract';
export type { PopulationData, PyramidRow, YearTotal, ProvinceYear, ProvincePopulation } from './population-contract';

let pending: Promise<PopulationData> | undefined;

async function fetchPopulation(): Promise<PopulationData> {
  const response = await fetch(assetUrl('/data/observations/population.json'));
  if (!response.ok) throw new Error('Population data unavailable');
  const value: unknown = await response.json();
  if (!isPopulationData(value)) throw new Error('Population data failed validation');
  return value;
}

/**
 * Reads the hand-maintained population file once per page; the map and the panel share the result.
 * There is no worker or schedule: BPS publishes once a year. A failed read is retried on the next call.
 */
export function loadPopulation(): Promise<PopulationData> {
  if (!pending) {
    pending = fetchPopulation();
    pending.catch(() => { pending = undefined; });
  }
  return pending;
}

/** One region's male and female head counts per age group, in persons (not thousands). */
export interface RegionAgeCounts { male: number[]; female: number[] }

export interface RegionPyramidData {
  schemaVersion: 1;
  kind: 'population-pyramid-regions';
  sourceUrl: string;
  maleSourceUrl: string;
  attribution: string;
  year: number;
  unit: string;
  provinceCode: string;
  ageGroups: string[];
  regions: Record<string, RegionAgeCounts>;
}

const regionPyramids = new Map<string, Promise<RegionPyramidData>>();

function isAgeRow(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(item => Number.isFinite(item) && item >= 0);
}

function isRegionPyramidData(value: unknown, provinceCode: string): value is RegionPyramidData {
  if (!value || typeof value !== 'object') return false;
  const data = value as RegionPyramidData;
  if (data.schemaVersion !== 1 || data.kind !== 'population-pyramid-regions' || data.provinceCode !== provinceCode) return false;
  if (!Number.isInteger(data.year) || !Array.isArray(data.ageGroups) || data.ageGroups.length === 0) return false;
  if (!data.regions || typeof data.regions !== 'object') return false;
  const rows = Object.values(data.regions);
  if (rows.length === 0) return false;
  return rows.every(row => isAgeRow(row.male, data.ageGroups.length) && isAgeRow(row.female, data.ageGroups.length));
}

async function fetchRegionPyramids(provinceCode: string): Promise<RegionPyramidData> {
  const response = await fetch(assetUrl('/data/observations/population-regions/' + provinceCode + '.json'));
  if (!response.ok) throw new Error('Regional population data unavailable');
  const value: unknown = await response.json();
  if (!isRegionPyramidData(value, provinceCode)) throw new Error('Regional population data failed validation');
  return value;
}

/** Province and regency/city age pyramids come in one small file per province, loaded when that province is selected. */
export function loadRegionPyramids(provinceCode: string): Promise<RegionPyramidData> {
  const cached = regionPyramids.get(provinceCode);
  if (cached) return cached;
  const pending = fetchRegionPyramids(provinceCode);
  regionPyramids.set(provinceCode, pending);
  pending.catch(() => { regionPyramids.delete(provinceCode); });
  return pending;
}

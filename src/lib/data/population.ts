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

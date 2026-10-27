/**
 * Rounded national figures shown on the home page. They come from public statistics and are revised over time
 * (BPS population projection 2024 and 2010 census ethnic groups, BIG island count 2023, Badan Bahasa language
 * mapping 2023, BPS and maritime-authority land and sea areas), so each one is displayed as approximate.
 */
export type NationalFactId = 'islands' | 'population' | 'languages' | 'ethnicGroups' | 'seaArea' | 'landArea';
export type FactUnit = 'none' | 'million' | 'millionKm2';

export interface NationalFact {
  id: NationalFactId;
  /** Value in the unit below: 281.6 with unit "million" means 281.6 million. */
  value: number;
  decimals: number;
  unit: FactUnit;
}

export const NATIONAL_FACTS: readonly NationalFact[] = [
  { id: 'islands', value: 17380, decimals: 0, unit: 'none' },
  { id: 'population', value: 281.6, decimals: 1, unit: 'million' },
  { id: 'languages', value: 718, decimals: 0, unit: 'none' },
  { id: 'ethnicGroups', value: 1340, decimals: 0, unit: 'none' },
  { id: 'seaArea', value: 3.25, decimals: 2, unit: 'millionKm2' },
  { id: 'landArea', value: 1.91, decimals: 2, unit: 'millionKm2' }
];

/** One step of an ease-out count-up: 0 at the start, 1 at the end, fast first and slow last. */
export function easeOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - (1 - clamped) ** 3;
}

/** Value to show `elapsed` ms into an animation from `from` to `to` lasting `duration` ms. */
export function countUpValue(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0) return to;
  return from + (to - from) * easeOutCubic(elapsed / duration);
}

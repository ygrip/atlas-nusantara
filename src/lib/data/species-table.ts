import { SPECIES_STATUSES } from './species-validation.js';
import type { SpeciesRecord } from './species-contract';

export type SpeciesSortKey = 'status' | 'name' | 'scientific';
export type SpeciesSortDirection = 'ascending' | 'descending';
export type SpeciesProtectionFilter = 'all' | 'protected';

export interface SpeciesFilterOptions {
  query?: string;
  group?: string;
  status?: string;
  protection?: SpeciesProtectionFilter;
}

/** Name shown for a species: local name, then English name, then the Latin name. */
export function displayName(record: SpeciesRecord): string {
  return record.name || record.nameEn || record.scientificName;
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function filterSpecies(records: readonly SpeciesRecord[], options: SpeciesFilterOptions): SpeciesRecord[] {
  const query = normalize(options.query ?? '');
  return records.filter(record => {
    if (options.group && options.group !== 'all' && record.group !== options.group) return false;
    if (options.status && options.status !== 'all' && record.status !== options.status) return false;
    if (options.protection === 'protected' && !record.protected) return false;
    if (!query) return true;
    const searchable = normalize([record.scientificName, record.name, record.nameEn, record.family, ...(record.aliases ?? []), record.id].join(' '));
    return searchable.includes(query);
  });
}

export function sortSpecies(records: readonly SpeciesRecord[], key: SpeciesSortKey, direction: SpeciesSortDirection, locale: string): SpeciesRecord[] {
  let multiplier = 1;
  if (direction === 'descending') multiplier = -1;
  return records.map((record, index) => ({ record, index })).sort((left, right) => {
    let comparison = 0;
    if (key === 'status') comparison = SPECIES_STATUSES.indexOf(left.record.status) - SPECIES_STATUSES.indexOf(right.record.status);
    if (key === 'name') comparison = displayName(left.record).localeCompare(displayName(right.record), locale, { sensitivity: 'base' });
    if (key === 'scientific') comparison = left.record.scientificName.localeCompare(right.record.scientificName, 'en', { sensitivity: 'base' });
    if (comparison !== 0) return comparison * multiplier;
    // Ties keep the file order, which already puts the best-documented species first.
    return left.index - right.index;
  }).map(item => item.record);
}

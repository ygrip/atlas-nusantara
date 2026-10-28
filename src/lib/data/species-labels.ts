import { m } from '$lib/i18n/messages';
import type { SpeciesGroup, SpeciesRealm, SpeciesStatus } from './species-contract';

/** IUCN Red List category colours; the text colour keeps the badge readable on the pale ones. */
const STATUS_COLORS: Record<SpeciesStatus, string> = {
  EX: '#000000', EW: '#542344', CR: '#d81e05', EN: '#fc7f3f', VU: '#f9e814', NT: '#cce226', LC: '#60c659', DD: '#d1d1c6', NE: '#e7e5df'
};
const LIGHT_TEXT_STATUSES: SpeciesStatus[] = ['EX', 'EW', 'CR'];

export function speciesStatusColor(status: SpeciesStatus): string {
  return STATUS_COLORS[status];
}

export function speciesStatusTextColor(status: SpeciesStatus): string {
  if (LIGHT_TEXT_STATUSES.includes(status)) return '#ffffff';
  return '#1a1a1a';
}

export function speciesStatusLabel(status: SpeciesStatus): string {
  const labels: Record<SpeciesStatus, () => string> = {
    EX: m.species_status_ex, EW: m.species_status_ew, CR: m.species_status_cr, EN: m.species_status_en, VU: m.species_status_vu,
    NT: m.species_status_nt, LC: m.species_status_lc, DD: m.species_status_dd, NE: m.species_status_ne
  };
  return labels[status]();
}

export function speciesGroupLabel(group: SpeciesGroup): string {
  const labels: Record<SpeciesGroup, () => string> = {
    mammals: m.species_group_mammals, birds: m.species_group_birds, reptiles: m.species_group_reptiles, amphibians: m.species_group_amphibians,
    fishes: m.species_group_fishes, insects: m.species_group_insects, arachnids: m.species_group_arachnids, crustaceans: m.species_group_crustaceans,
    molluscs: m.species_group_molluscs, cnidarians: m.species_group_cnidarians, 'other-animals': m.species_group_other_animals,
    flowering: m.species_group_flowering, conifers: m.species_group_conifers, ferns: m.species_group_ferns, mosses: m.species_group_mosses,
    algae: m.species_group_algae, 'other-plants': m.species_group_other_plants
  };
  return labels[group]();
}

export function speciesRealmLabel(realm: SpeciesRealm): string {
  const labels: Record<SpeciesRealm, () => string> = { marine: m.species_realm_marine, freshwater: m.species_realm_freshwater, terrestrial: m.species_realm_terrestrial };
  return labels[realm]();
}

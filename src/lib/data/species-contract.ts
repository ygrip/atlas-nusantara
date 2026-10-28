export type SpeciesKind = 'flora' | 'fauna';
/** IUCN Red List category; NE means no source gave one (not evaluated or not matched). */
export type SpeciesStatus = 'EX' | 'EW' | 'CR' | 'EN' | 'VU' | 'NT' | 'LC' | 'DD' | 'NE';
export type FaunaGroup = 'mammals' | 'birds' | 'reptiles' | 'amphibians' | 'fishes' | 'insects' | 'arachnids' | 'crustaceans' | 'molluscs' | 'cnidarians' | 'other-animals';
export type FloraGroup = 'flowering' | 'conifers' | 'ferns' | 'mosses' | 'algae' | 'other-plants';
export type SpeciesGroup = FaunaGroup | FloraGroup;
export type SpeciesRealm = 'marine' | 'freshwater' | 'terrestrial';
export type SpeciesSource = 'gbif' | 'ksdae' | 'inaturalist' | 'animalworldmap' | 'earthsendangered';

/**
 * A photo that stays on iNaturalist; it is linked with credit and licence, never copied into the repository.
 * The id and extension rebuild every URL (see species-images.ts), which keeps the province files small.
 */
export interface SpeciesImage {
  /** iNaturalist photo id. */
  id: number;
  ext: 'jpg' | 'jpeg' | 'png' | 'gif';
  /** Author name. */
  credit: string;
  /** iNaturalist licence code such as "cc-by-nc", or "" when all rights are reserved. */
  license: string;
}

export interface SpeciesRecord {
  /** GBIF species key. */
  id: string;
  scientificName: string;
  /** Indonesian or local common name, "" when none is known. */
  name: string;
  nameEn: string;
  aliases?: string[];
  group: SpeciesGroup;
  family: string;
  status: SpeciesStatus;
  /** On the KSDAE list of protected species (Indonesia). */
  protected?: true;
  cites?: 'I' | 'II' | 'III';
  /** Raw listing text from Earth's Endangered Creatures, e.g. "VU-IUCN: 2008". */
  listing?: string;
  realms: SpeciesRealm[];
  /** Habitat description when a source states one; "" otherwise. */
  habitat: string;
  summary: string;
  summaryLanguage?: 'id' | 'en';
  /** Provinces where GBIF has recorded the species (atlas province codes). */
  provinces: string[];
  /** One to four photos; the first is the lead photo. A placeholder is shown when there are none. */
  images?: SpeciesImage[];
  wikipediaUrl?: string;
  /** GBIF occurrence records in Indonesia, a rough measure of how well known the species is. */
  records?: number;
  sources: SpeciesSource[];
}

export interface SpeciesCatalog {
  schemaVersion: 1;
  kind: SpeciesKind;
  fetchedAt: string;
  /** Null for the national aggregate. */
  provinceCode: string | null;
  species: SpeciesRecord[];
}

export interface SpeciesProvinceSummary {
  provinceCode: string;
  count: number;
  threatened: number;
  withImage: number;
  shard: string;
}

export interface SpeciesIndex {
  schemaVersion: 1;
  kind: SpeciesKind;
  fetchedAt: string;
  scope: string;
  license: string;
  attribution: string;
  national?: string;
  sources: { name: string; url: string }[];
  coverage: {
    totalSpecies: number;
    /** Species with no province in the source data; listed in the national file only. */
    withoutProvince: number;
    withImage: number;
    withCommonName: number;
    withSummary: number;
    withHabitat: number;
    withStatus: number;
    threatened: number;
    protectedSpecies: number;
  };
  statusCounts: Partial<Record<SpeciesStatus, number>>;
  groupCounts: Partial<Record<SpeciesGroup, number>>;
  provinces: SpeciesProvinceSummary[];
}

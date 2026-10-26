/**
 * Schematic tile layout for the 37 provinces of the 2022 code edition.
 * Each province gets one cell on a 15 × 8 grid placed by approximate west–east / north–south position.
 * This is a navigation diagram, not geography: it carries no boundaries, areas or adjacency claims.
 */
export type IslandGroup = 'sumatra' | 'java' | 'nusa-tenggara' | 'kalimantan' | 'sulawesi' | 'maluku' | 'papua';

export interface ProvinceTile {
  code: string;
  /** Common Indonesian short form, e.g. JABAR for Jawa Barat. */
  abbreviation: string;
  column: number;
  row: number;
  group: IslandGroup;
}

export const TILE_COLUMNS = 15;
export const TILE_ROWS = 8;

export const ISLAND_GROUP_NAMES: Record<IslandGroup, string> = {
  sumatra: 'Sumatra',
  java: 'Jawa',
  'nusa-tenggara': 'Bali & Nusa Tenggara',
  kalimantan: 'Kalimantan',
  sulawesi: 'Sulawesi',
  maluku: 'Maluku',
  papua: 'Papua'
};

export const PROVINCE_TILES: ProvinceTile[] = [
  { code: '11', abbreviation: 'ACEH', column: 1, row: 1, group: 'sumatra' },
  { code: '12', abbreviation: 'SUMUT', column: 2, row: 2, group: 'sumatra' },
  { code: '21', abbreviation: 'KEPRI', column: 4, row: 2, group: 'sumatra' },
  { code: '13', abbreviation: 'SUMBAR', column: 2, row: 3, group: 'sumatra' },
  { code: '14', abbreviation: 'RIAU', column: 3, row: 3, group: 'sumatra' },
  { code: '17', abbreviation: 'BKL', column: 2, row: 4, group: 'sumatra' },
  { code: '15', abbreviation: 'JAMBI', column: 3, row: 4, group: 'sumatra' },
  { code: '16', abbreviation: 'SUMSEL', column: 4, row: 5, group: 'sumatra' },
  { code: '19', abbreviation: 'BABEL', column: 5, row: 5, group: 'sumatra' },
  { code: '18', abbreviation: 'LPG', column: 4, row: 6, group: 'sumatra' },
  { code: '31', abbreviation: 'DKI', column: 6, row: 6, group: 'java' },
  { code: '36', abbreviation: 'BANTEN', column: 5, row: 7, group: 'java' },
  { code: '32', abbreviation: 'JABAR', column: 6, row: 7, group: 'java' },
  { code: '33', abbreviation: 'JATENG', column: 7, row: 7, group: 'java' },
  { code: '34', abbreviation: 'DIY', column: 7, row: 8, group: 'java' },
  { code: '35', abbreviation: 'JATIM', column: 8, row: 7, group: 'java' },
  { code: '51', abbreviation: 'BALI', column: 9, row: 7, group: 'nusa-tenggara' },
  { code: '52', abbreviation: 'NTB', column: 10, row: 7, group: 'nusa-tenggara' },
  { code: '53', abbreviation: 'NTT', column: 11, row: 7, group: 'nusa-tenggara' },
  { code: '65', abbreviation: 'KALTARA', column: 8, row: 2, group: 'kalimantan' },
  { code: '61', abbreviation: 'KALBAR', column: 6, row: 3, group: 'kalimantan' },
  { code: '64', abbreviation: 'KALTIM', column: 8, row: 3, group: 'kalimantan' },
  { code: '62', abbreviation: 'KALTENG', column: 7, row: 4, group: 'kalimantan' },
  { code: '63', abbreviation: 'KALSEL', column: 8, row: 4, group: 'kalimantan' },
  { code: '75', abbreviation: 'GTLO', column: 10, row: 2, group: 'sulawesi' },
  { code: '71', abbreviation: 'SULUT', column: 11, row: 2, group: 'sulawesi' },
  { code: '72', abbreviation: 'SULTENG', column: 10, row: 3, group: 'sulawesi' },
  { code: '76', abbreviation: 'SULBAR', column: 9, row: 4, group: 'sulawesi' },
  { code: '73', abbreviation: 'SULSEL', column: 9, row: 5, group: 'sulawesi' },
  { code: '74', abbreviation: 'SULTRA', column: 10, row: 5, group: 'sulawesi' },
  { code: '82', abbreviation: 'MALUT', column: 12, row: 2, group: 'maluku' },
  { code: '81', abbreviation: 'MALUKU', column: 12, row: 4, group: 'maluku' },
  { code: '92', abbreviation: 'PABAR', column: 13, row: 3, group: 'papua' },
  { code: '91', abbreviation: 'PAPUA', column: 14, row: 3, group: 'papua' },
  { code: '94', abbreviation: 'PATENG', column: 14, row: 4, group: 'papua' },
  { code: '95', abbreviation: 'PAPEG', column: 15, row: 4, group: 'papua' },
  { code: '93', abbreviation: 'PASEL', column: 15, row: 5, group: 'papua' }
];

export function tileFor(code: string): ProvinceTile | undefined {
  return PROVINCE_TILES.find(tile => tile.code === code);
}

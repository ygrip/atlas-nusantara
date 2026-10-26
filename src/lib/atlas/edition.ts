/** The administrative code edition every region file, geometry package and BMKG lookup shares. */
export const CODE_EDITION = 'Kepmendagri 300.2.2-2430/2025';
export const CODE_EDITION_YEAR = '2025';
export const ADMIN_DATA_PATH = '/data/admin-2025';
export const GEOMETRY_DATA_PATH = '/data/geometry-2025';
export const EDITION_COUNTS = { provinces: 38, cities: 514, regencies: 416, municipalities: 98 } as const;

/** Kemendagri names city-level regions "Kota …" (Jakarta: "Kota Administrasi …"). */
export function isMunicipality(name: string): boolean {
  return /^kota\s/i.test(name);
}

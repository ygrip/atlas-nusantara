/** Explicit city-code moves from the previously shipped 2022 directory to the 2025 directory. */
const CITY_UPGRADES: Record<string, string> = {
  '92.01': '96.01', // Sorong
  '92.04': '96.02', // Sorong Selatan
  '92.05': '96.03', // Raja Ampat
  '92.09': '96.04', // Tambrauw
  '92.10': '96.05', // Maybrat
  '92.71': '96.71'  // Kota Sorong
};

export function upgradeRegionCode(code: string): string {
  return CITY_UPGRADES[code] ?? code;
}

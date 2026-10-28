/** Local languages per province from Badan Bahasa's Peta Bahasa; see docs/OVERLAYS.md. */
export interface ProvinceLanguages {
  /** Two-digit atlas province code. */
  code: string;
  count: number;
  /** Language names, sorted. A language spoken in several provinces appears in each. */
  languages: string[];
}

export interface LanguageData {
  schemaVersion: 1;
  kind: 'local-languages';
  source: string;
  sourceUrl: string;
  attribution: string;
  fetchedAt: string;
  /** Distinct languages in the source, which is less than the sum of the province counts. */
  totalLanguages: number;
  note: string;
  provinces: ProvinceLanguages[];
}

/** Upper bound of each heat class; the last class is open ended. Fixed so a count always has the same colour. */
export const LANGUAGE_CLASS_MAXIMUMS = [5, 12, 30, 70];

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isValidProvince(province: ProvinceLanguages): boolean {
  if (!/^\d{2}$/.test(province.code) || !Number.isInteger(province.count) || province.count < 1) return false;
  if (!Array.isArray(province.languages) || province.languages.length !== province.count) return false;
  if (!province.languages.every(name => typeof name === 'string' && name.length > 0 && name.length <= 120)) return false;
  return new Set(province.languages).size === province.languages.length;
}

/** Strict input contract; the layer shows nothing rather than counts that do not match their language lists. */
export function isLanguageData(value: unknown): value is LanguageData {
  if (!value || typeof value !== 'object') return false;
  const data = value as LanguageData;
  if (data.schemaVersion !== 1 || data.kind !== 'local-languages') return false;
  if (!data.source || !isHttpsUrl(data.sourceUrl) || !Number.isFinite(Date.parse(data.fetchedAt))) return false;
  if (!Number.isInteger(data.totalLanguages) || data.totalLanguages < 1) return false;
  if (!Array.isArray(data.provinces) || data.provinces.length === 0 || data.provinces.length > 60) return false;
  if (new Set(data.provinces.map(province => province.code)).size !== data.provinces.length) return false;
  if (!data.provinces.every(isValidProvince)) return false;
  // Every language is in at least one province, so the province lists cover at least the distinct total.
  const placed = data.provinces.reduce((sum, province) => sum + province.count, 0);
  return placed >= data.totalLanguages;
}

/** Index of the heat class (0 = fewest) for a language count. */
export function languageClassIndex(count: number): number {
  const index = LANGUAGE_CLASS_MAXIMUMS.findIndex(maximum => count <= maximum);
  if (index === -1) return LANGUAGE_CLASS_MAXIMUMS.length;
  return index;
}

/** Provinces with the most languages first; ties keep province-code order. */
export function rankProvinces(data: LanguageData): ProvinceLanguages[] {
  return [...data.provinces].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

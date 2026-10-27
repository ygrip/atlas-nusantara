/** Manually maintained national population by age group and sex (BPS, thousand persons). One entry per year. */
export interface PopulationYear {
  year: number;
  male: number[];
  female: number[];
  /** Totals exactly as BPS publishes them; the age rows can differ from these by rounding only. */
  published: { male: number; female: number; total: number };
}

/** One province in one year, exactly as BPS publishes it. Population is in thousand persons. */
export interface ProvinceYear {
  year: number;
  population: number;
  growthPercent: number;
  densityPerKm2: number;
  /** Men per 100 women. */
  sexRatio: number;
}

export interface ProvincePopulation {
  /** Two-digit code of the atlas boundary edition, not the BPS code (they differ for the Papua provinces). */
  code: string;
  name: string;
  years: ProvinceYear[];
  /** Set when the province was created or redrawn: earlier BPS values describe a different area and are not comparable. */
  comparableFrom?: number;
}

export interface PopulationData {
  schemaVersion: 2;
  kind: 'population-pyramid';
  source: string;
  sourceUrl: string;
  totalSourceUrl: string;
  provinceSourceUrl: string;
  attribution: string;
  fetchedAt: string;
  unit: string;
  ageGroups: string[];
  years: PopulationYear[];
  provinces: ProvincePopulation[];
}

/** BPS rounds each cell to 0.1 thousand, so a sum of 16 cells may drift a little from the published total. */
export const ROUNDING_TOLERANCE = 1;
/** The overlay keeps a rolling five-year window of yearly data. */
export const MAX_YEARS = 5;

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isPositiveRow(row: unknown, length: number): row is number[] {
  return Array.isArray(row) && row.length === length && row.every(value => Number.isFinite(value) && value >= 0);
}

function closeTo(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= ROUNDING_TOLERANCE;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isValidYear(entry: PopulationYear, ageGroupCount: number): boolean {
  if (!Number.isInteger(entry.year) || entry.year < 1900 || entry.year > 2200) return false;
  if (!isPositiveRow(entry.male, ageGroupCount) || !isPositiveRow(entry.female, ageGroupCount)) return false;
  const published = entry.published;
  if (!published || ![published.male, published.female, published.total].every(Number.isFinite)) return false;
  if (!closeTo(sum(entry.male), published.male) || !closeTo(sum(entry.female), published.female)) return false;
  return closeTo(published.male + published.female, published.total);
}

function isValidProvinceYear(entry: ProvinceYear, years: Set<number>): boolean {
  if (!years.has(entry.year)) return false;
  return [entry.population, entry.growthPercent, entry.densityPerKm2, entry.sexRatio].every(Number.isFinite) && entry.population > 0;
}

function isValidProvince(province: ProvincePopulation, years: Set<number>): boolean {
  if (!/^\d{2}$/.test(province.code) || typeof province.name !== 'string' || !province.name) return false;
  if (!Array.isArray(province.years) || province.years.length === 0 || province.years.length > years.size) return false;
  if (new Set(province.years.map(entry => entry.year)).size !== province.years.length) return false;
  if (province.comparableFrom !== undefined && !years.has(province.comparableFrom)) return false;
  return province.years.every(entry => isValidProvinceYear(entry, years));
}

/** Provinces must add up to the national total of each year, so a mistyped cell cannot slip in. */
function provincesMatchNational(data: PopulationData): boolean {
  return data.years.every(entry => {
    const total = data.provinces.reduce((sumSoFar, province) => {
      const match = province.years.find(item => item.year === entry.year);
      if (!match) return sumSoFar;
      return sumSoFar + match.population;
    }, 0);
    return closeTo(total, entry.published.total);
  });
}

/** Strict input contract; the layer shows nothing rather than a total that does not add up. */
export function isPopulationData(value: unknown): value is PopulationData {
  if (!value || typeof value !== 'object') return false;
  const data = value as PopulationData;
  if (data.schemaVersion !== 2 || data.kind !== 'population-pyramid') return false;
  if (!data.source || !isHttpsUrl(data.sourceUrl) || !isHttpsUrl(data.totalSourceUrl) || !isHttpsUrl(data.provinceSourceUrl)) return false;
  if (!Number.isFinite(Date.parse(data.fetchedAt)) || typeof data.unit !== 'string') return false;
  if (!Array.isArray(data.ageGroups) || data.ageGroups.length === 0 || data.ageGroups.length > 40) return false;
  if (!data.ageGroups.every(group => typeof group === 'string' && group.length > 0 && group.length <= 20)) return false;
  if (!Array.isArray(data.years) || data.years.length === 0 || data.years.length > MAX_YEARS) return false;
  const years = data.years.map(entry => entry.year);
  const ascending = years.every((year, index) => index === 0 || year === years[index - 1] + 1);
  if (!ascending) return false;
  if (!data.years.every(entry => isValidYear(entry, data.ageGroups.length))) return false;
  if (!Array.isArray(data.provinces) || data.provinces.length === 0 || data.provinces.length > 60) return false;
  const yearSet = new Set(years);
  if (new Set(data.provinces.map(province => province.code)).size !== data.provinces.length) return false;
  if (!data.provinces.every(province => isValidProvince(province, yearSet))) return false;
  return provincesMatchNational(data);
}

export interface PyramidRow {
  ageGroup: string;
  male: number;
  female: number;
}

export function pyramidRows(data: PopulationData, year: number): PyramidRow[] {
  const entry = data.years.find(item => item.year === year);
  if (!entry) return [];
  return data.ageGroups.map((ageGroup, index) => ({ ageGroup, male: entry.male[index], female: entry.female[index] }));
}

export interface YearTotal {
  year: number;
  male: number;
  female: number;
  total: number;
  /** Change versus the previous year in the data, in thousand persons; absent for the first year. */
  change?: number;
  /** Percent change versus the previous year; absent for the first year. */
  changePercent?: number;
}

export function yearTotals(data: PopulationData): YearTotal[] {
  return data.years.map((entry, index) => {
    const row: YearTotal = { year: entry.year, male: entry.published.male, female: entry.published.female, total: entry.published.total };
    if (index === 0) return row;
    const previous = data.years[index - 1].published.total;
    row.change = row.total - previous;
    row.changePercent = (row.change / previous) * 100;
    return row;
  });
}

/** Province rows for one province, leaving out years whose values describe a different boundary. */
export function provinceSeries(data: PopulationData, code: string): ProvinceYear[] {
  const province = data.provinces.find(item => item.code === code);
  if (!province) return [];
  const from = province.comparableFrom ?? 0;
  return province.years.filter(entry => entry.year >= from);
}

export function provinceYear(data: PopulationData, code: string, year: number): ProvinceYear | undefined {
  return provinceSeries(data, code).find(entry => entry.year === year);
}

/** Newest year in the file. */
export function latestYear(data: PopulationData): number {
  return data.years[data.years.length - 1].year;
}

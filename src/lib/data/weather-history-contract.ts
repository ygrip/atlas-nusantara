/** Daily weather history: one representative point per city/regency over the last seven full days. */
export type HistoryMetric = 'tmean' | 'rain' | 'hu' | 'tcc' | 'ws';

export const HISTORY_METRICS: HistoryMetric[] = ['tmean', 'rain', 'hu', 'tcc', 'ws'];

/** Per-day values; null where the provider returned nothing for that day. */
export type DailyValues = (number | null)[];

export interface HistoryPoint {
  code: string;
  lat: number;
  lon: number;
  tmean: DailyValues;
  tmin: DailyValues;
  tmax: DailyValues;
  rain: DailyValues;
  hu: DailyValues;
  tcc: DailyValues;
  ws: DailyValues;
}

export interface WeatherHistory {
  schemaVersion: 1;
  kind: 'weather-history';
  source: string;
  sourceUrl: string;
  license: string;
  attribution: string;
  codeEdition: string;
  fetchedAt: string;
  timeZone: string;
  /** Calendar dates (YYYY-MM-DD), oldest first. */
  days: string[];
  units: Record<string, string>;
  points: HistoryPoint[];
}

/** Furthest a neighbour may be before its weather is no longer a fair stand-in. */
export const MAX_NEIGHBOUR_KM = 250;

const COLUMNS: (keyof HistoryPoint)[] = ['tmean', 'tmin', 'tmax', 'rain', 'hu', 'tcc', 'ws'];

function isColumn(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every(item => item === null || Number.isFinite(item));
}

export function isWeatherHistory(value: unknown): value is WeatherHistory {
  if (!value || typeof value !== 'object') return false;
  const history = value as WeatherHistory;
  if (history.kind !== 'weather-history' || history.schemaVersion !== 1) return false;
  if (typeof history.source !== 'string' || typeof history.attribution !== 'string' || typeof history.sourceUrl !== 'string') return false;
  if (!Number.isFinite(Date.parse(history.fetchedAt))) return false;
  if (!Array.isArray(history.days) || history.days.length === 0 || history.days.length > 31) return false;
  if (!history.days.every(day => /^\d{4}-\d{2}-\d{2}$/.test(day))) return false;
  if (!Array.isArray(history.points) || history.points.length === 0 || history.points.length > 1000) return false;
  const codes = new Set<string>();
  for (const point of history.points) {
    if (!/^\d{2}\.\d{2}$/.test(point.code) || codes.has(point.code)) return false;
    codes.add(point.code);
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) return false;
    if (!COLUMNS.every(column => isColumn(point[column], history.days.length))) return false;
  }
  return true;
}

export function hasHistory(point: HistoryPoint): boolean {
  return point.tmean.some(value => value !== null);
}

export function distanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const radians = Math.PI / 180;
  const dLat = (latB - latA) * radians;
  const dLon = (lonB - lonA) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latA * radians) * Math.cos(latB * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export interface Coordinates { lat: number; lon: number }
export interface LocatedCode extends Coordinates { code: string }

export interface Neighbour { code: string; distanceKm: number }

/** The closest candidate to a position, or undefined when there is none within `limitKm`. */
export function nearestNeighbour(candidates: LocatedCode[], target: Coordinates, limitKm = MAX_NEIGHBOUR_KM): Neighbour | undefined {
  let best: Neighbour | undefined;
  for (const candidate of candidates) {
    const distance = distanceKm(target.lat, target.lon, candidate.lat, candidate.lon);
    if (distance > limitKm) continue;
    if (!best || distance < best.distanceKm) best = { code: candidate.code, distanceKm: distance };
  }
  return best;
}

export type HistoryScope = 'national' | 'province' | 'city';

/** Daily values for the chart: every metric, plus the daily minimum and maximum temperature. */
export interface DailySeries {
  days: string[];
  tmean: DailyValues;
  tmin: DailyValues;
  tmax: DailyValues;
  rain: DailyValues;
  hu: DailyValues;
  tcc: DailyValues;
  ws: DailyValues;
}

export interface RegionHistory {
  scope: HistoryScope;
  series: DailySeries;
  /** Cities/regencies whose own history is in the series. */
  cities: number;
  /** Set when the region has no history of its own and a neighbouring city stands in for it. */
  neighbour?: Neighbour;
}

function averageOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const mean = present.reduce((sum, value) => sum + value, 0) / present.length;
  return Math.round(mean * 10) / 10;
}

function averageSeries(days: string[], points: HistoryPoint[]): DailySeries {
  const column = (name: HistoryMetric | 'tmin' | 'tmax'): DailyValues => days.map((_, index) => averageOf(points.map(point => point[name][index])));
  return { days, tmean: column('tmean'), tmin: column('tmin'), tmax: column('tmax'), rain: column('rain'), hu: column('hu'), tcc: column('tcc'), ws: column('ws') };
}

function meanPosition(points: Coordinates[]): Coordinates {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lon = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
  return { lat, lon };
}

function inRegion(pointCode: string, regionCode: string): boolean {
  return pointCode === regionCode || pointCode.startsWith(regionCode + '.');
}

/**
 * The history that describes a region, or undefined when neither the region nor a close neighbour has any.
 * No code is the whole country, a two-digit code a province (the average of its cities) and a city its own point.
 * A city or province with no history borrows the nearest city that has some; the result says so.
 */
export function regionHistory(history: WeatherHistory, code: string | undefined): RegionHistory | undefined {
  const withData = history.points.filter(hasHistory);
  if (!code) {
    if (withData.length === 0) return undefined;
    return { scope: 'national', series: averageSeries(history.days, withData), cities: withData.length };
  }
  const regionPoints = history.points.filter(point => inRegion(point.code, code));
  if (regionPoints.length === 0) return undefined;
  const scope: HistoryScope = code.includes('.') ? 'city' : 'province';
  const own = regionPoints.filter(hasHistory);
  if (own.length > 0) return { scope, series: averageSeries(history.days, own), cities: own.length };
  const outside = withData.filter(point => !inRegion(point.code, code));
  const neighbour = nearestNeighbour(outside, meanPosition(regionPoints));
  if (!neighbour) return undefined;
  const stand = withData.find(point => point.code === neighbour.code);
  if (!stand) return undefined;
  return { scope, series: averageSeries(history.days, [stand]), cities: 1, neighbour };
}

import { isBmkgSource, loadSavedSnapshot } from './saved-snapshot.ts';

export interface Earthquake {
  id: string;
  observedAt: string;
  lat: number;
  lon: number;
  magnitude: number;
  depthKm: number;
  place: string;
  potential: string;
}

export interface EarthquakeArchive {
  schemaVersion: 1;
  kind: 'earthquake-archive';
  source: string;
  sourceUrl: string;
  termsUrl: string;
  attribution: string;
  fetchedAt: string;
  coverage: string;
  events: Earthquake[];
}

let pending: Promise<EarthquakeArchive | undefined> | undefined;
let cachedAt = 0;

export async function loadEarthquakes(): Promise<EarthquakeArchive | undefined> {
  if (!pending || Date.now() - cachedAt >= 15 * 60_000) {
    cachedAt = Date.now();
    pending = loadSavedSnapshot('/data/observations/earthquakes.json', isEarthquakeArchive);
  }
  return pending;
}

export function isEarthquakeArchive(value: unknown): value is EarthquakeArchive {
  if (!value || typeof value !== 'object') return false;
  const archive = value as EarthquakeArchive;
  if (archive.schemaVersion !== 1 || archive.kind !== 'earthquake-archive' || !Number.isFinite(Date.parse(archive.fetchedAt)) || !Array.isArray(archive.events) || archive.events.length > 1000) return false;
  if (!isBmkgSource(archive.sourceUrl) || !isBmkgSource(archive.termsUrl)) return false;
  const ids = new Set<string>();
  for (const event of archive.events) {
    if (!event.id || ids.has(event.id) || typeof event.place !== 'string') return false;
    if (![event.lon, event.lat, event.magnitude, event.depthKm].every(Number.isFinite) || Math.abs(event.lon) > 180 || Math.abs(event.lat) > 90 || !Number.isFinite(Date.parse(event.observedAt))) return false;
    ids.add(event.id);
  }
  return true;
}

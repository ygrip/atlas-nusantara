export type LandmarkKind = 'natural' | 'built';
export interface Landmark {
  id: string;
  provinceCode: string;
  name: string;
  kind: LandmarkKind;
  /** Optional verified coordinates for future provider imports, never guessed from a name. */
  lon?: number;
  lat?: number;
  /** Optional Commons file title, e.g. "File:Example.jpg". */
  commonsFile?: string;
  sourceUrl?: string;
}
export interface DestinationCatalog {
  schemaVersion: 1;
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  scope: string;
  landmarks: Landmark[];
}
export function validateDestinationCatalog(value: unknown): value is DestinationCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as DestinationCatalog;
  if (catalog.schemaVersion !== 1 || !Number.isFinite(Date.parse(catalog.fetchedAt)) || typeof catalog.source !== 'string'
    || typeof catalog.scope !== 'string' || typeof catalog.sourceUrl !== 'string'
    || !Array.isArray(catalog.landmarks) || catalog.landmarks.length > 50000) return false;
  const ids = new Set<string>();
  for (const item of catalog.landmarks) {
    if (!item || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)
      || !/^(1[1-9]|2[1]|3[1-6]|5[1-3]|6[1-5]|7[1-6]|8[1-2]|9[1-6])$/.test(item.provinceCode)
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200
      || !['natural', 'built'].includes(item.kind)
      || ((item.lon === undefined) !== (item.lat === undefined))
      || (item.lon !== undefined && (!Number.isFinite(item.lon) || !Number.isFinite(item.lat) || Math.abs(item.lon) > 180 || Math.abs(item.lat!) > 90))
      || (item.commonsFile !== undefined && (!/^File:[^<>]{1,220}$/.test(item.commonsFile)))
      || (item.sourceUrl !== undefined && !/^https:\/\//.test(item.sourceUrl))) return false;
    ids.add(item.id);
  }
  return true;
}


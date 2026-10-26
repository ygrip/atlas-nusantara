import { makeSnapshot, type DatasetType, type Snapshot } from './ingestion/schema.ts';

export type PublishedKind = DatasetType;
export type PublicationName = 'summary' | PublishedKind;

export interface PublicationManifest {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  validUntil: string;
  summary: string;
  snapshots: Partial<Record<PublishedKind, string>>;
}

export interface PublishedData<T> {
  data: T;
  validUntil: string;
}

export class PublicationUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'PublicationUnavailableError'; }
}

const MANIFEST_URL = '/data/published/manifest.json';
const kinds = new Set(['warning', 'earthquake', 'incident', 'hazard']);
let cachedManifest: PublicationManifest | undefined;
let cachedAt = 0;
let manifestRequest: Promise<PublicationManifest> | undefined;

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function validPointer(value: unknown, revision: string, file: string): value is string {
  return value === `/data/published/${revision}/${file}`;
}

function isPublishedKind(value: string): value is PublishedKind { return kinds.has(value); }

function validateManifest(value: unknown): PublicationManifest {
  if (!value || typeof value !== 'object') throw new PublicationUnavailableError('Published manifest is invalid');
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1 || typeof item.revision !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.revision)) throw new PublicationUnavailableError('Published manifest version is invalid');
  if (!validTimestamp(item.generatedAt) || !validTimestamp(item.validUntil)) throw new PublicationUnavailableError('Published dates are invalid');
  const generated = Date.parse(item.generatedAt);
  const expiry = Date.parse(item.validUntil);
  if (expiry <= Date.now() || generated > Date.now() + 300000 || generated >= expiry || expiry - generated > 15 * 60000) throw new PublicationUnavailableError('Published data is expired or has invalid dates');
  if (!validPointer(item.summary, item.revision, 'summary.json')) throw new PublicationUnavailableError('Published summary pointer is invalid');
  if (!item.snapshots || typeof item.snapshots !== 'object' || Array.isArray(item.snapshots)) throw new PublicationUnavailableError('Published snapshots are invalid');
  const snapshots: PublicationManifest['snapshots'] = {};
  for (const [kind, pointer] of Object.entries(item.snapshots)) {
    if (!isPublishedKind(kind) || !validPointer(pointer, item.revision, kind + '.json')) throw new PublicationUnavailableError('Published snapshot pointer is invalid');
    snapshots[kind] = pointer;
  }
  return { schemaVersion: 1, revision: item.revision, generatedAt: item.generatedAt, validUntil: item.validUntil, summary: item.summary, snapshots };
}

function publicUrl(path: string): string {
  const origin = import.meta.env?.VITE_PUBLIC_DATA_ORIGIN;
  if (!origin) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '[::1]') return path;
    throw new PublicationUnavailableError('Production hot data requires a direct public CDN origin');
  }
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new PublicationUnavailableError('Invalid public data origin');
  return new URL(path, url.origin).href;
}

async function fetchManifest(): Promise<PublicationManifest> {
  if (cachedManifest && Date.now() - cachedAt < 60_000 && Date.parse(cachedManifest.validUntil) > Date.now()) return cachedManifest;
  if (manifestRequest) return manifestRequest;
  manifestRequest = (async () => {
    const response = await fetch(publicUrl(MANIFEST_URL), { cache: 'default', credentials: 'omit' });
    if (!response.ok) throw new PublicationUnavailableError('Published manifest is unavailable');
    const manifest = validateManifest(await response.json());
    cachedManifest = manifest;
    cachedAt = Date.now();
    return manifest;
  })();
  try { return await manifestRequest; }
  finally { manifestRequest = undefined; }
}

async function fetchPayload<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError');
  const response = await fetch(publicUrl(url), { signal, cache: 'default', credentials: 'omit' });
  if (!response.ok) throw new PublicationUnavailableError('Published data is unavailable');
  return await response.json() as T;
}

/** The browser reads only the signed-off static publication; D1 remains server-side. */
export async function loadPublished<T = unknown>(name: PublicationName, signal?: AbortSignal): Promise<PublishedData<T>> {
  const manifest = await fetchManifest();
  if (signal?.aborted) throw new DOMException('The request was aborted', 'AbortError');
  let pointer: string | undefined;
  if (name === 'summary') pointer = manifest.summary;
  else pointer = manifest.snapshots[name];
  if (!pointer) throw new PublicationUnavailableError('No published snapshot is available');
  const payload = await fetchPayload<T>(pointer, signal);
  if (Date.parse(manifest.validUntil) <= Date.now()) throw new PublicationUnavailableError('Published data expired during the request');
  if (name !== 'summary') {
    const snapshot = payload as Snapshot;
    if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.records) || snapshot.records.some(record => record.type !== name)) throw new PublicationUnavailableError('Published snapshot does not match its manifest');
    const payloadExpiry = snapshot.provenance?.validUntil;
    let validUntil = manifest.validUntil;
    if (payloadExpiry && validTimestamp(payloadExpiry) && Date.parse(payloadExpiry) < Date.parse(validUntil)) validUntil = payloadExpiry;
    if (publicationExpired(validUntil)) throw new PublicationUnavailableError('Published snapshot expired');
    return { data: makeSnapshot(snapshot.provenance, snapshot.records, snapshot.generatedAt, name) as T, validUntil };
  }
  return { data: payload, validUntil: manifest.validUntil };
}

/** Recheck cached static data when a tab resumes; expired UI must not look current. */
export function publicationExpired(validUntil: string, now = Date.now()): boolean {
  return !validTimestamp(validUntil) || Date.parse(validUntil) <= now;
}

export function clearPublicationCache(): void {
  cachedManifest = undefined;
  cachedAt = 0;
}

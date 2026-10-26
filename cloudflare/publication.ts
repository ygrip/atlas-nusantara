import type { DatasetType, Snapshot } from '../src/lib/data/ingestion/schema';

const PREFIX = 'data/published/';
const MAX_HOT_BYTES = 2_000_000;

export interface HotManifest {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  validUntil: string;
  summary: string;
  snapshots: Partial<Record<'warning' | 'earthquake' | 'incident' | 'hazard', string>>;
}

async function putJson(bucket: R2Bucket, key: string, value: unknown, generatedAt: string, validUntil: string): Promise<void> {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > MAX_HOT_BYTES) throw Error('Hot JSON exceeds the static publication budget');
  const age = Math.max(0, Math.min(60, Math.floor((Date.parse(validUntil) - Date.now()) / 1000)));
  await bucket.put(key, text, {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: `public, max-age=${age}, must-revalidate`, cacheExpiry: new Date(validUntil) },
    customMetadata: { generatedAt, validUntil }
  });
}

/** Publish payloads first, the pointer last; overlapping cron runs cannot roll back the manifest. */
export async function publishHot(bucket: R2Bucket, summary: unknown, snapshots: Partial<Record<DatasetType, Snapshot>>, now: number): Promise<HotManifest> {
  const generatedAt = new Date(now).toISOString();
  let deadline = now + 15 * 60000;
  for (const [kind, snapshot] of Object.entries(snapshots)) {
    if (snapshot.provenance.validUntil) deadline = Math.min(deadline, Date.parse(snapshot.provenance.validUntil));
    if (kind === 'warning') deadline = Math.min(deadline, Date.parse(snapshot.provenance.fetchedAt) + 15 * 60000);
  }
  if (deadline <= Date.now()) throw Error('Publication expired before it could be written');
  const validUntil = new Date(deadline).toISOString();
  const revision = crypto.randomUUID();
  const root = PREFIX + revision + '/';
  const manifest: HotManifest = { schemaVersion: 1, revision, generatedAt, validUntil, summary: '/' + root + 'summary.json', snapshots: {} };
  await putJson(bucket, root + 'summary.json', summary, generatedAt, validUntil);
  for (const kind of ['warning', 'earthquake', 'incident', 'hazard'] as const) {
    const snapshot = snapshots[kind];
    if (!snapshot) continue;
    const key = root + kind + '.json';
    await putJson(bucket, key, snapshot, generatedAt, validUntil);
    manifest.snapshots[kind] = '/' + key;
  }
  const manifestKey = PREFIX + 'manifest.json';
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await bucket.head(manifestKey);
    if (current?.customMetadata?.generatedAt && current.customMetadata.generatedAt >= generatedAt) return manifest;
    let onlyIf: R2Conditional = { etagDoesNotMatch: '*' };
    if (current) onlyIf = { etagMatches: current.etag };
    const committed = await bucket.put(manifestKey, JSON.stringify(manifest), {
      onlyIf,
      httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: `public, max-age=${Math.max(0, Math.min(60, Math.floor((deadline - Date.now()) / 1000)))}, must-revalidate`, cacheExpiry: new Date(validUntil) },
      customMetadata: { generatedAt, validUntil }
    });
    if (committed) return manifest;
  }
  throw Error('Concurrent publication prevented manifest promotion');
}

/** Local/same-origin fallback only. Production hot traffic should use the R2 CDN domain directly. */
export async function serveHot(request: Request, bucket: R2Bucket): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!/^\/data\/published\/(?:manifest\.json|[a-f0-9-]{36}\/(?:summary\.json|(?:warning|earthquake|incident|hazard)\.json))$/.test(path)) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  const object = await bucket.get(path.slice(1));
  const expiry = Date.parse(object?.customMetadata?.validUntil ?? '');
  if (!object || !Number.isFinite(expiry) || expiry <= Date.now()) return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  const headers = new Headers({ 'x-content-type-options': 'nosniff' });
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  const age = Math.max(0, Math.min(60, Math.floor((expiry - Date.now()) / 1000)));
  headers.set('cache-control', `public, max-age=${age}, must-revalidate`);
  let body: ReadableStream | null = object.body;
  if (request.method === 'HEAD') body = null;
  return new Response(body, { headers });
}

export async function cleanPublications(bucket: R2Bucket, now: number): Promise<void> {
  let cursor: string | undefined;
  do {
    const objects = await bucket.list({ prefix: PREFIX, cursor, include: ['customMetadata'] });
    const expired = objects.objects.filter(object => object.key !== PREFIX + 'manifest.json' && Date.parse(object.customMetadata?.validUntil ?? '') <= now).map(object => object.key);
    if (expired.length) await bucket.delete(expired);
    cursor = undefined;
    if (objects.truncated) cursor = objects.cursor;
  } while (cursor);
}

import type { DatasetType, Snapshot } from '../src/lib/data/ingestion/schema';

const PREFIX = 'data/published/';
const MAX_HOT_BYTES = 2_000_000;
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' };

export interface HotManifest {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  validUntil: string;
  summary: string;
  snapshots: Partial<Record<'warning' | 'earthquake' | 'incident' | 'hazard', string>>;
}

function assertJsonBudget(text: string): void {
  if (new TextEncoder().encode(text).byteLength > MAX_HOT_BYTES) throw Error('Hot JSON exceeds the static publication budget');
}

function publicationStatement(db: D1Database, key: string, text: string, generatedAt: string, validUntil: string): D1PreparedStatement {
  return db.prepare('INSERT INTO publications (key, payload_json, generated_at, valid_until) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload_json = excluded.payload_json, generated_at = excluded.generated_at, valid_until = excluded.valid_until WHERE excluded.generated_at > publications.generated_at')
    .bind(key, text, generatedAt, validUntil);
}

/** Store one bounded JSON publication without allowing an older run to overwrite a newer one. */
export async function storePublication(db: D1Database, key: string, text: string, generatedAt: string, validUntil: string): Promise<void> {
  assertJsonBudget(text);
  if (!Number.isFinite(Date.parse(generatedAt)) || !Number.isFinite(Date.parse(validUntil)) || Date.parse(validUntil) <= Date.parse(generatedAt)) throw Error('Publication dates are invalid');
  await publicationStatement(db, key, text, generatedAt, validUntil).run();
}

/** Publish payloads and the manifest in one D1 batch; the manifest update is monotonic by generatedAt. */
export async function publishHot(db: D1Database, summary: unknown, snapshots: Partial<Record<DatasetType, Snapshot>>, now: number): Promise<HotManifest> {
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
  const statements: D1PreparedStatement[] = [];
  const summaryText = JSON.stringify(summary);
  assertJsonBudget(summaryText);
  statements.push(publicationStatement(db, root + 'summary.json', summaryText, generatedAt, validUntil));
  for (const kind of ['warning', 'earthquake', 'incident', 'hazard'] as const) {
    const snapshot = snapshots[kind];
    if (!snapshot) continue;
    const key = root + kind + '.json';
    const text = JSON.stringify(snapshot);
    assertJsonBudget(text);
    statements.push(publicationStatement(db, key, text, generatedAt, validUntil));
    manifest.snapshots[kind] = '/' + key;
  }
  const manifestText = JSON.stringify(manifest);
  assertJsonBudget(manifestText);
  statements.push(publicationStatement(db, PREFIX + 'manifest.json', manifestText, generatedAt, validUntil));
  await db.batch(statements);
  return manifest;
}

interface PublicationRow { payload_json: string; generated_at: string; valid_until: string }

/** Serve one unexpired D1 publication. Callers supply an allowlisted key, never a request-derived key. */
export async function servePublication(request: Request, db: D1Database, key: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  const row = await db.prepare('SELECT payload_json, generated_at, valid_until FROM publications WHERE key = ?').bind(key).first<PublicationRow>();
  const expiry = Date.parse(row?.valid_until ?? '');
  if (!row || !Number.isFinite(expiry) || expiry <= Date.now()) return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  const age = Math.max(0, Math.min(60, Math.floor((expiry - Date.now()) / 1000)));
  const headers = new Headers({ ...JSON_HEADERS, etag: '"' + await digest(row.payload_json) + '"', 'cache-control': `public, max-age=${age}, must-revalidate` });
  headers.set('x-publication-valid-until', row.valid_until);
  let body: BodyInit | null = row.payload_json;
  if (request.method === 'HEAD') body = null;
  return new Response(body, { headers });
}

async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Serve only the versioned publication namespace, rejecting arbitrary database key access. */
export async function serveHot(request: Request, db: D1Database): Promise<Response> {
  const path = new URL(request.url).pathname;
  const pattern = /^\/data\/published\/(?:manifest\.json|[a-f0-9-]{36}\/(?:summary\.json|(?:warning|earthquake|incident|hazard)\.json))$/;
  if (!pattern.test(path)) return new Response('Not found', { status: 404 });
  return servePublication(request, db, path.slice(1));
}

export async function cleanPublications(db: D1Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM publications WHERE key LIKE ? AND valid_until <= ?').bind(PREFIX + '%', new Date(now).toISOString()).run();
}

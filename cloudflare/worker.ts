import { adaptBmkgCap, InactiveCapWarningError } from '../src/lib/data/ingestion/cap.ts';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createExportResponse, exportFitsBudget } from './export.ts';
import { verifyArchiveRequest, type ColdDownloadEnv } from './cold-download.ts';
import { publishHot, serveHot, servePublication, cleanPublications, noPublication } from './publication.ts';
import { runHazardSchedule } from './hazards.ts';
import { runLiveSnapshots } from './snapshots.ts';
import { liveKeyForPath } from './live-snapshots.ts';
import { cleanupRateLimits } from './rate-limit.ts';
import { adaptBmkgEarthquakes } from '../src/lib/data/ingestion/adapters.ts';
import { makeSnapshot, validateProvenance, type DatasetProvenance, type DatasetRecord, type DatasetType, type Snapshot } from '../src/lib/data/ingestion/schema.ts';

/** Must match the second entry of `triggers.crons` in wrangler.jsonc. */
const LIVE_SNAPSHOT_CRON = '2,22,42 * * * *';
const DAY_MS = 86_400_000;
const MAX_BODY_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_FETCHES_PER_RUN = 10;
const MAX_CAP_DETAILS = 40;
const MAX_CAP_BYTES = 8_000_000;
const CRAWL_DEADLINE_MS = 120_000;
const ALLOWED_HOSTS = new Set(['data.bmkg.go.id', 'www.bmkg.go.id']);
const rssParser = new XMLParser({ ignoreAttributes: true, processEntities: false, parseTagValue: false, isArray: (name: string) => name === 'item' });

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface SourceDefinition {
  id: string;
  name: string;
  type: DatasetType | null;
  intervalMinutes: number;
  url: string;
  termsUrl: string;
  enabled: boolean;
  reason?: string;
}

export const SOURCE_REGISTRY: SourceDefinition[] = [
  { id: 'bmkg-earthquakes', name: 'BMKG earthquakes (M5+ archive)', type: 'earthquake', intervalMinutes: 15, url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', termsUrl: 'https://data.bmkg.go.id/gempabumi/', enabled: true, reason: 'Requires operator-reviewed dataset reuse terms and displayed BMKG attribution.' },
  { id: 'bmkg-nowcast', name: 'BMKG weather warnings', type: 'warning', intervalMinutes: 5, url: 'https://www.bmkg.go.id/alerts/nowcast/id', termsUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/', enabled: true, reason: 'CAP geospatial areas have no verified administrative-code crosswalk; no region-matched alerts are claimed.' },
  { id: 'bnpb-incidents', name: 'BNPB disaster incidents', type: 'incident', intervalMinutes: 360, url: 'https://data.bnpb.go.id/', termsUrl: 'https://data.bnpb.go.id/', enabled: false, reason: 'Dataset schema, license, and region code edition are unverified.' },
  { id: 'inarisk-hazards', name: 'InaRISK modeled hazards', type: 'hazard', intervalMinutes: 10080, url: 'https://inarisk.bnpb.go.id/', termsUrl: 'https://inarisk.bnpb.go.id/', enabled: false, reason: 'Layer schema, boundary vintage, and redistribution rights are unverified.' },
  { id: 'nasa-firms', name: 'NASA FIRMS fire detections', type: null, intervalMinutes: 60, url: 'https://firms.modaps.eosdis.nasa.gov/', termsUrl: 'https://firms.modaps.eosdis.nasa.gov/', enabled: false, reason: 'Authentication, schema, data mapping, and redistribution review required.' },
  { id: 'worldpop', name: 'WorldPop population estimates', type: null, intervalMinutes: 43200, url: 'https://www.worldpop.org/', termsUrl: 'https://www.worldpop.org/', enabled: false, reason: 'Population is a static estimate rather than a scheduled warning feed; dataset rights and processing need review.' }
];

export interface Summary {
  generatedAt: string;
  retentionDays: 365;
  hotWindowDays: 30;
  summaryScope: 'recent collected observations, not a complete national total';
  sourceCoverage: 'only sources with verified provider schemas and approved redistribution terms';
  sources: Array<{ id: string; name: string; type: DatasetType | null; status: string; lastSuccessAt: string | null; nextDueAt: string | null; intervalMinutes: number; sourceUrl: string; termsUrl: string; reason?: string }>;
  counts: Record<DatasetType, number>;
  activeWarningCount: number | null;
  observations: Array<{ id: string; type: DatasetType; observedAt: string | null; properties: DatasetRecord['properties'] }>;
  derivedInsights: Array<{ id: string; label: string; count: number; basis: string }>;
  derivedFacts: Array<{ id: string; label: string; value: string | number; basis: string }>;
}

function approvedSources(env: Partial<Env>): Set<string> {
  return new Set((env.APPROVED_SOURCE_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean));
}

function sourceApproval(source: SourceDefinition, env: Partial<Env>): { license: string; licenseUrl: string; reviewer: string; reviewedAt: string } | undefined {
  let license: string | undefined;
  let licenseUrl: string | undefined;
  let reviewer: string | undefined;
  let reviewedAt: string | undefined;
  if (source.id === 'bmkg-earthquakes') {
    license = env.BMKG_EARTHQUAKES_LICENSE;
    licenseUrl = env.BMKG_EARTHQUAKES_LICENSE_URL;
    reviewer = env.BMKG_EARTHQUAKES_REVIEWED_BY;
    reviewedAt = env.BMKG_EARTHQUAKES_REVIEWED_AT;
  }
  if (source.id === 'bmkg-nowcast') {
    license = env.BMKG_NOWCAST_LICENSE;
    licenseUrl = env.BMKG_NOWCAST_LICENSE_URL;
    reviewer = env.BMKG_NOWCAST_REVIEWED_BY;
    reviewedAt = env.BMKG_NOWCAST_REVIEWED_AT;
  }
  // An empty REVIEWED_AT means "stamp the run time": the operator names who reviewed the terms, the Worker records when it last ran under them.
  if (!reviewedAt?.trim()) reviewedAt = new Date().toISOString();
  if (!license || !licenseUrl || !reviewer) return undefined;
  try {
    validateProvenance({ source: source.name, sourceUrl: source.url, sourcePublishedAt: null, fetchedAt: new Date().toISOString(), validUntil: null, license, licenseUrl, reviewedBy: reviewer, reviewedAt, coverage: [], edition: null });
  } catch { return undefined; }
  return { license, licenseUrl, reviewer, reviewedAt };
}

export function enabledSources(env: Partial<Env>): SourceDefinition[] {
  const approved = approvedSources(env);
  return SOURCE_REGISTRY.filter(source => source.enabled && source.type !== null && approved.has(source.id) && sourceApproval(source, env) !== undefined);
}

export function retentionCutoff(now: number): string {
  return new Date(now - 365 * DAY_MS).toISOString();
}

export function sourceStatus(source: SourceDefinition, state: { last_success_at: string | null; last_error: string | null } | undefined, now = Date.now()): string {
  if (!source.enabled) return 'disabled';
  if (!state) return 'not-configured';
  if (!state.last_success_at) {
    if (state.last_error) return 'error';
    return 'never-run';
  }
  if (state.last_error) return 'error';
  if (now - Date.parse(state.last_success_at) > source.intervalMinutes * 180_000) return 'stale';
  return 'healthy';
}

function json(body: unknown, status = 200, cacheControl = 'no-store'): Response {
  return Response.json(body, { status, headers: { 'cache-control': cacheControl } });
}

function unavailable(source: SourceDefinition, reason: string, status = 503): Response {
  return json({ status: 'unavailable', source: source.id, reason }, status);
}

async function boundedText(response: Response): Promise<string> {
  if (!response.body) throw Error('Source returned an empty body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) throw Error('Source response exceeds the ingestion size limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel(error);
    throw error;
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

function provenanceFor(source: SourceDefinition, approval: NonNullable<ReturnType<typeof sourceApproval>>, now: number): DatasetProvenance {
  const fetchedAt = new Date(now).toISOString();
  let agency = source.name;
  if (source.id.startsWith('bmkg-')) agency = 'BMKG';
  return { source: agency, sourceUrl: source.url, sourcePublishedAt: null, fetchedAt, validUntil: null,
    license: approval.license, licenseUrl: approval.licenseUrl, reviewedBy: approval.reviewer, reviewedAt: approval.reviewedAt, coverage: [], edition: null };
}

/** Workers cannot use redirect: 'error'; 'manual' returns the 3xx answer itself, which `response.ok` then rejects. */
export async function fetchSource(source: SourceDefinition, approval: NonNullable<ReturnType<typeof sourceApproval>>, now = Date.now(), fetcher: typeof fetch = fetch): Promise<Snapshot> {
  const deadline = Date.now() + CRAWL_DEADLINE_MS;
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname)) throw Error('Unapproved ingestion origin');
  const response = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json, application/rss+xml, application/xml, text/xml' }, redirect: 'manual' });
  if (!response.ok) throw Error('Provider HTTP ' + response.status);
  const fetchedAt = new Date(now).toISOString();
  const provenance = provenanceFor(source, approval, now);
  if (source.id === 'bmkg-earthquakes') {
    const payload = JSON.parse(await boundedText(response));
    return adaptBmkgEarthquakes(payload, { provenance, generatedAt: fetchedAt, regions: { has: () => false } });
  }
  if (source.id === 'bmkg-nowcast') {
    const xml = await boundedText(response);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw Error('BMKG warning RSS XML is malformed or contains forbidden entities');
    const feed = rssParser.parse(xml) as { rss?: { channel?: { title?: string; link?: string; item?: Array<{ link?: string }> } } };
    if (!feed.rss?.channel || typeof feed.rss.channel !== 'object' || typeof feed.rss.channel.title !== 'string' || typeof feed.rss.channel.link !== 'string') throw Error('BMKG warning RSS channel is invalid');
    const items = feed.rss.channel.item ?? [];
    if (!Array.isArray(items)) throw Error('BMKG warning RSS items are invalid');
    if (items.length > MAX_CAP_DETAILS) throw Error('BMKG warning feed exceeds the supported complete-coverage fetch limit');
    const records: DatasetRecord[] = [];
    const expiries: number[] = [];
    let publishedAt: string | null = null;
    let collectedBytes = 0;
    for (const item of items) {
      const detailUrl = item.link?.trim();
      if (!detailUrl) throw Error('BMKG warning RSS item is missing its detail link');
      const detail = new URL(detailUrl);
      if (detail.protocol !== 'https:' || detail.hostname !== 'www.bmkg.go.id' || detail.port || detail.username || detail.password || detail.search || detail.hash || !/^\/alerts\/nowcast\/id\/[A-Za-z0-9_-]+_alert\.xml$/.test(detail.pathname)) throw Error('BMKG warning detail URL is invalid');
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw Error('BMKG warning collection exceeded its bounded run time');
      const alertResponse = await fetcher(detail.href, { signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, remaining)), headers: { accept: 'application/xml, text/xml' }, redirect: 'manual' });
      if (!alertResponse.ok) throw Error('BMKG warning detail fetch failed with HTTP ' + alertResponse.status);
      const capProvenance = { ...provenance, sourceUrl: detail.href };
      const capXml = await boundedText(alertResponse);
      collectedBytes += new TextEncoder().encode(capXml).byteLength;
      if (collectedBytes > MAX_CAP_BYTES) throw Error('BMKG warning collection exceeds its total memory budget');
      const cap = parseActiveCap(capXml, capProvenance, fetchedAt);
      if (!cap) continue;
      for (const record of cap.records) {
        const expiry = record.properties.expires;
        const sent = record.observedAt;
        if (typeof expiry !== 'string' || typeof sent !== 'string') throw Error('BMKG warning timestamps are missing');
        expiries.push(Date.parse(expiry));
        if (!publishedAt || Date.parse(sent) < Date.parse(publishedAt)) publishedAt = sent;
        records.push(record);
      }
    }
    let validUntil: string | null = null;
    if (expiries.length > 0) validUntil = new Date(Math.min(...expiries)).toISOString();
    const snapshotProvenance = { ...provenance, sourcePublishedAt: publishedAt, validUntil };
    return makeSnapshot(snapshotProvenance, records, fetchedAt, 'warning');
  }
  throw Error('Provider adapter is intentionally unavailable');
}

/** Expired or not-yet-effective items are normal feed lag, not a broken crawl; malformed items still fail closed. */
function parseActiveCap(xml: string, provenance: DatasetProvenance, fetchedAt: string): Snapshot | undefined {
  try {
    return adaptBmkgCap(xml, { provenance, generatedAt: fetchedAt });
  } catch (error) {
    if (error instanceof InactiveCapWarningError) return undefined;
    throw error;
  }
}

async function cleanupExpired(db: D1Database, now: number): Promise<number> {
  const cutoff = retentionCutoff(now);
  const result = await db.prepare('DELETE FROM observations WHERE first_seen_at <= ? OR (observed_at IS NOT NULL AND observed_at <= ?)').bind(cutoff, cutoff).run();
  return result.meta.changes;
}

async function fetchSummary(db: D1Database, env: Env, now: number): Promise<Summary> {
  const cutoff = new Date(now - 30 * DAY_MS).toISOString();
  const approvedIds = enabledSources(env).map(source => source.id);
  let sourceClause = ' AND 0';
  if (approvedIds.length > 0) sourceClause = ` AND source_id IN (${approvedIds.map(() => '?').join(',')})`;
  const sources = await Promise.all(SOURCE_REGISTRY.map(async source => {
    const state = await db.prepare('SELECT last_success_at, last_error, next_due_at FROM source_state WHERE source_id = ?').bind(source.id).first<{ last_success_at: string | null; last_error: string | null; next_due_at: string }>();
    const reviewed = sourceApproval(source, env) !== undefined;
    const allowed = approvedSources(env).has(source.id) && reviewed;
    const active = source.enabled && allowed;
    let status = sourceStatus({ ...source, enabled: active }, state ?? undefined, now);
    if (source.enabled && !allowed) status = 'not-configured';
    let lastSuccessAt: string | null = null;
    let nextDueAt: string | null = null;
    if (active) { lastSuccessAt = state?.last_success_at ?? null; nextDueAt = state?.next_due_at ?? null; }
    const result: Summary['sources'][number] = { id: source.id, name: source.name, type: source.type, status,
      lastSuccessAt, nextDueAt, intervalMinutes: source.intervalMinutes, sourceUrl: source.url, termsUrl: source.termsUrl };
    if (!active && source.enabled) {
      result.reason = 'Awaiting operator review of dataset-specific redistribution rights.';
      if (reviewed) result.reason = 'Enable this source in APPROVED_SOURCE_IDS after review.';
    }
    else if (!active && source.reason) result.reason = source.reason;
    return result;
  }));
  const nowIso = new Date(now).toISOString();
  const rows = await db.prepare('SELECT kind, COUNT(*) as count FROM observations WHERE first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?)' + sourceClause + ' GROUP BY kind').bind(cutoff, cutoff, ...approvedIds).all<{kind:string; count:number}>();
  const counts: Record<DatasetType, number> = { warning: 0, earthquake: 0, incident: 0, hazard: 0 };
  for (const row of rows.results) if (row.kind in counts) counts[row.kind as DatasetType] = row.count;
  const activeWarnings = await db.prepare("SELECT COUNT(*) AS count FROM observations WHERE kind = 'warning' AND first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?) AND expires_at > ? AND source_id IN (SELECT source_id FROM source_state WHERE last_error IS NULL AND last_success_at > ? AND observations.last_seen_at = last_success_at)" + sourceClause).bind(cutoff, cutoff, nowIso, new Date(now - 15 * 60000).toISOString(), ...approvedIds).first<{count:number}>();
  let activeWarningCount: number | null = null;
  if (sources.some(source => source.id === 'bmkg-nowcast' && source.status === 'healthy')) activeWarningCount = activeWarnings?.count ?? 0;
  const records = await db.prepare('SELECT id, kind, observed_at, json_extract(payload_json, \'$.properties\') AS properties_json FROM observations WHERE first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?)' + sourceClause + ' ORDER BY observed_at DESC LIMIT 50').bind(cutoff, cutoff, ...approvedIds).all<{id:string; kind:string; observed_at:string|null; properties_json:string}>();
  const observations = records.results.map(row => ({ id: row.id, type: row.kind as DatasetType, observedAt: row.observed_at, properties: JSON.parse(row.properties_json) as DatasetRecord['properties'] }));
  const derivedInsights = [
    { id: 'warning-records', label: 'Retained warning records', count: counts.warning, basis: 'Provider warning records collected within the recent 30-day publication window; not a measure of national risk.' },
    { id: 'earthquake-observations', label: 'Retained earthquake observations', count: counts.earthquake, basis: 'Provider earthquake observations within the recent 30-day publication window; an observation is not a forecast.' },
    { id: 'incident-records', label: 'Retained historical incident records', count: counts.incident, basis: 'Provider incident rows within the recent 30-day publication window; source coverage may be incomplete.' }
  ];
  const earthquakeStats = await db.prepare("SELECT MAX(CAST(json_extract(payload_json, '$.properties.magnitude') AS REAL)) AS max_magnitude, AVG(CAST(json_extract(payload_json, '$.properties.magnitude') AS REAL)) AS average_magnitude, MIN(observed_at) AS oldest_observation, MAX(observed_at) AS latest_observation FROM observations WHERE kind = 'earthquake' AND first_seen_at > ? AND observed_at > ?" + sourceClause).bind(cutoff, cutoff, ...approvedIds).first<{max_magnitude:number|null; average_magnitude:number|null; oldest_observation:string|null; latest_observation:string|null}>();
  const derivedFacts: Summary['derivedFacts'] = [];
  if (earthquakeStats?.max_magnitude !== null && earthquakeStats?.max_magnitude !== undefined) derivedFacts.push({ id: 'max-earthquake-magnitude', label: 'Largest reported earthquake magnitude', value: earthquakeStats.max_magnitude, basis: 'Maximum BMKG-reported magnitude among retained earthquake observations; not a forecast or hazard score.' });
  if (earthquakeStats?.average_magnitude !== null && earthquakeStats?.average_magnitude !== undefined) derivedFacts.push({ id: 'average-earthquake-magnitude', label: 'Average reported earthquake magnitude', value: Number(earthquakeStats.average_magnitude.toFixed(1)), basis: 'Arithmetic mean among retained BMKG earthquake archive rows; source coverage is not a census of all quakes.' });
  if (earthquakeStats?.oldest_observation && earthquakeStats.latest_observation) derivedFacts.push({ id: 'earthquake-coverage-span', label: 'Earthquake archive time span', value: earthquakeStats.oldest_observation + ' to ' + earthquakeStats.latest_observation, basis: 'Earliest and latest retained provider timestamps; not evidence of complete historical coverage.' });
  return { generatedAt: nowIso, retentionDays: 365, hotWindowDays: 30, summaryScope: 'recent collected observations, not a complete national total', sourceCoverage: 'only sources with verified provider schemas and approved redistribution terms', sources, counts, activeWarningCount, observations, derivedInsights, derivedFacts };
}

async function fetchSnapshot(sourceId: string, db: D1Database, env: Env, now: number): Promise<Response> {
  const source = SOURCE_REGISTRY.find(item => item.id === sourceId);
  if (!source || !source.type) return json({ status: 'unavailable', reason: 'Unknown source.' }, 404);
  const approval = sourceApproval(source, env);
  if (!source.enabled || !approvedSources(env).has(source.id) || !approval) return unavailable(source, source.reason ?? 'Provider adapter is not activated.');
  let activeCondition = '';
  const hotCutoff = new Date(now - 30 * DAY_MS).toISOString();
  const bindings = [sourceId, hotCutoff, hotCutoff];
  if (source.type === 'warning') {
    activeCondition = ' AND expires_at > ? AND last_seen_at = (SELECT last_success_at FROM source_state WHERE source_id = ?)';
    bindings.push(new Date(now).toISOString(), sourceId);
  }
  const rows = await db.prepare('SELECT payload_json FROM observations WHERE source_id = ? AND first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?)' + activeCondition + ' ORDER BY observed_at DESC LIMIT 201').bind(...bindings).all<{payload_json:string}>();
  const state = await db.prepare('SELECT last_success_at, last_error FROM source_state WHERE source_id = ?').bind(sourceId).first<{last_success_at:string|null; last_error:string|null}>();
  if (!state?.last_success_at) return unavailable(source, 'No verified provider snapshot is currently available.');
  if (source.type === 'warning' && sourceStatus(source, state, now) !== 'healthy') return unavailable(source, 'Current warnings are withheld until a complete, fresh crawl succeeds.');
  if (rows.results.length === 0) return json(makeSnapshot(provenanceFor(source, approval, Date.parse(state.last_success_at)), [], new Date(now).toISOString(), source.type));
  if (source.type === 'warning' && rows.results.length > 200) return unavailable(source, 'Complete warning collection exceeds the static publication budget.');
  const records = rows.results.slice(0, 200).map(row => JSON.parse(row.payload_json) as DatasetRecord);
  const provenance = provenanceFor(source, approval, Date.parse(state.last_success_at));
  provenance.coverage = ['Recent published observations within 30 days; at most 200 records, not the full retained archive.'];
  if (source.type === 'warning') {
    const expiryTimes = records.map(record => record.properties.expires).filter((value): value is string => typeof value === 'string').map(value => Date.parse(value)).filter(value => Number.isFinite(value));
    if (expiryTimes.length === 0) return unavailable(source, 'No warning in this snapshot has a verified expiry time.');
    provenance.validUntil = new Date(Math.min(...expiryTimes)).toISOString();
  }
  const snapshot = makeSnapshot(provenance, records, new Date(now).toISOString(), source.type);
  if (source.type === 'warning' && (state.last_success_at === null || state.last_error !== null)) return unavailable(source, 'The latest warning crawl failed; current warnings are withheld until a complete crawl succeeds.');
  return json(snapshot, 200, 'no-store');
}

async function ingestOne(source: SourceDefinition, db: D1Database, env: Env, now: number): Promise<void> {
  const approval = sourceApproval(source, env);
  if (!approval || !source.type) return;
  const runAt = new Date(now).toISOString();
  await db.prepare('INSERT INTO source_state (source_id, next_due_at) VALUES (?, ?) ON CONFLICT(source_id) DO NOTHING').bind(source.id, runAt).run();
  const nextDueAt = new Date(now + source.intervalMinutes * 60_000).toISOString();
  const claim = await db.prepare('UPDATE source_state SET last_attempt_at = ?, next_due_at = ? WHERE source_id = ? AND next_due_at <= ?').bind(runAt, nextDueAt, source.id, runAt).run();
  if (claim.meta.changes !== 1) return;
  try {
    const snapshot = await fetchSource(source, approval, now);
    const cutoff = retentionCutoff(now);
    const retainedRecords = snapshot.records.filter(record => {
      const observedAt = record.observedAt ?? snapshot.provenance.sourcePublishedAt;
      return runAt > cutoff && (!observedAt || Date.parse(observedAt) > Date.parse(cutoff));
    });
    const inserts = retainedRecords.map(record => {
      let expires: string | null = null;
      if (typeof record.properties.expires === 'string') expires = new Date(record.properties.expires).toISOString();
      let observedAt: string | null = null;
      const observedValue = record.observedAt ?? snapshot.provenance.sourcePublishedAt;
      if (observedValue) observedAt = new Date(observedValue).toISOString();
      const normalizedRecord = { ...record, observedAt, properties: { ...record.properties } };
      if (typeof normalizedRecord.properties.expires === 'string') normalizedRecord.properties.expires = expires;
      if (typeof normalizedRecord.properties.effective === 'string') normalizedRecord.properties.effective = new Date(normalizedRecord.properties.effective).toISOString();
      return db.prepare('INSERT INTO observations (id, source_id, kind, observed_at, expires_at, first_seen_at, last_seen_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, expires_at = excluded.expires_at, last_seen_at = excluded.last_seen_at WHERE observations.first_seen_at > ?')
        .bind(record.id, source.id, record.type, observedAt, expires, runAt, runAt, JSON.stringify(normalizedRecord), cutoff);
    });
    inserts.push(db.prepare('UPDATE source_state SET last_success_at = ?, last_error = NULL, last_record_count = ? WHERE source_id = ?').bind(runAt, retainedRecords.length, source.id));
    await db.batch(inserts);
  } catch (error) {
    const message = errorText(error);
    await db.prepare('UPDATE source_state SET last_error = ? WHERE source_id = ?').bind(message.slice(0, 500), source.id).run();
    console.error(JSON.stringify({ message: 'source-crawl-failed', source: source.id, error: message }));
  }
}

export async function runScheduled(db: D1Database, env: Env, now = Date.now()): Promise<{ due: string[]; deleted: number }> {
  const deleted = await cleanupExpired(db, now);
  const dueSources = enabledSources(env).slice(0, MAX_FETCHES_PER_RUN);
  for (const source of dueSources) await ingestOne(source, db, env, now);
  const summary = await fetchSummary(db, env, now);
  const snapshots: Partial<Record<DatasetType, Snapshot>> = {};
  for (const source of enabledSources(env)) {
    if (!source.type) continue;
    const response = await fetchSnapshot(source.id, db, env, now);
    if (response.ok) snapshots[source.type] = await response.json() as Snapshot;
  }
  await publishHot(db, summary, snapshots, now);
  await cleanPublications(db, now);
  await db.prepare('DELETE FROM archive_download_budget WHERE day < ?').bind(new Date(now - 30 * DAY_MS).toISOString().slice(0, 10)).run();
  await cleanupRateLimits(db, now);
  return { due: dueSources.map(source => source.id), deleted };
}

type RuntimeEnv = Env & Pick<ColdDownloadEnv, 'TURNSTILE_SECRET'>;

export async function coldDownload(request: Request, env: RuntimeEnv, now: number): Promise<Response> {
  const verified = await verifyArchiveRequest(request, env);
  if (verified instanceof Response) return verified;
  const definitions = enabledSources(env).filter(source => source.type === verified.kind);
  if (!definitions.length) return json({ status: 'unavailable', reason: 'No approved archive source is configured.' }, 503);
  const limit = Number(env.COLD_DAILY_DOWNLOAD_LIMIT);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) return json({ status: 'unavailable', reason: 'Archive budget is not configured.' }, 503);
  const day = new Date(now).toISOString().slice(0, 10);
  const allowance = await env.DB.prepare('INSERT INTO archive_download_budget(day, downloads) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET downloads = downloads + 1 WHERE downloads < ? RETURNING downloads').bind(day, limit).first<{ downloads: number }>();
  if (!allowance) {
    const response = json({ status: 'unavailable', reason: 'The daily archive download budget has been reached.' }, 429);
    response.headers.set('retry-after', String(Math.ceil((Date.parse(day) + DAY_MS - now) / 1000)));
    return response;
  }
  const sourceIds = definitions.map(source => source.id);
  const window = { from: verified.from, to: verified.to };
  const provenance = definitions.map(source => {
    const approval = sourceApproval(source, env);
    if (!approval) throw Error('Approved archive provenance is missing');
    return { id: source.id, sourceUrl: source.url, termsUrl: source.termsUrl, license: approval.license, licenseUrl: approval.licenseUrl };
  });
  if (!await exportFitsBudget(env.DB, verified.kind, sourceIds, now, window, provenance)) return json({ status: 'unavailable', reason: 'Choose a narrower UTC date range: at most 20,000 records, 10 MB of stored data and 32 MB of encoded output per request.' }, 413);
  return createExportResponse(env.DB, verified.kind, verified.format, sourceIds, now, provenance, window);
}

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/export') return await coldDownload(request, env, Date.now());
      if (path.startsWith('/api/')) return json({ error: 'Not found. Hot data is published as static JSON.' }, 404);
      if (path.startsWith('/data/published/')) {
        return await serveHot(request, env.DB);
      }
      const liveKey = liveKeyForPath(path);
      if (liveKey) return await servePublication(request, env.DB, liveKey);
      if (path === '/data/live/hazards.json') {
        if (!env.HAZARD_SOURCE_IDS?.trim()) return noPublication();
        return await servePublication(request, env.DB, 'data/observations/hazards.json');
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ message: 'request-failed', path, error: errorText(error) }));
      return json({ status: 'unavailable', reason: 'The requested data is temporarily unavailable.' }, 503);
    }
  },
  async scheduled(controller: ScheduledController, env: RuntimeEnv): Promise<void> {
    // The second cron (see wrangler.jsonc) is its own invocation with its own subrequest budget.
    if (controller.cron === LIVE_SNAPSHOT_CRON) {
      try {
        const live = await runLiveSnapshots(env.DB);
        console.log(JSON.stringify({ message: 'live-snapshots-complete', ...live }));
      } catch (error) {
        console.error(JSON.stringify({ message: 'live-snapshots-failed', error: errorText(error) }));
      }
      return;
    }
    const result = await runScheduled(env.DB, env);
    console.log(JSON.stringify({ message: 'scheduled-crawl-complete', ...result }));
    try {
      const hazards = await runHazardSchedule(env);
      console.log(JSON.stringify({ message: 'hazard-schedule-complete', ...hazards }));
    } catch (error) {
      console.error(JSON.stringify({ message: 'hazard-schedule-failed', error: errorText(error) }));
    }
  }
} satisfies ExportedHandler<RuntimeEnv>;

// Keeps the weather forecast, daily weather history and earthquake archive fresh from the scheduled Worker.
// Results go to the D1 `publications` table and are served at /data/live/* (see live-snapshots.ts); the static files
// bundled with each release remain the fallback. Everything is sized for the Workers free plan: at most 50 subrequests
// (fetches and D1 queries) per invocation, so the forecast is refreshed a few points per tick and history once a day.
import forecastPointList from '../static/data/admin-2025/forecast-points.json' with { type: 'json' };
import { storePublication } from './publication.ts';
import { fetchForecastPoint } from '../scripts/ingestion/lib/forecast.mjs';
import { buildHistory } from '../scripts/ingestion/lib/history.mjs';
import { buildEarthquakeArchive, EARTHQUAKE_SOURCE_URL } from '../scripts/ingestion/lib/earthquakes.mjs';
import { LIVE_KEYS } from './live-snapshots.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** 20 points at BMKG's 60 requests/minute is about 22 seconds and 20 subrequests; a full cycle is 26 ticks (about 2 hours). */
const POINTS_PER_TICK = 20;
const REQUEST_GAP_MS = 1100;
const FORECAST_FRESH_HOURS = 6;
const MIN_FRESH_RATIO = 0.9;
const FORECAST_PUBLISH_MINUTES = 15;
const EARTHQUAKE_MINUTES = 15;
const HISTORY_MINUTES = 23 * 60;
const HISTORY_RETRY_MINUTES = 30;

export interface ForecastPointDefinition { code: string; adm4: string; expectedName: string; lat: number; lon: number; providerCode?: string; providerName?: string }
const POINTS = forecastPointList.points as ForecastPointDefinition[];
const EDITION = forecastPointList.edition as string;

export interface SnapshotDependencies {
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  points?: ForecastPointDefinition[];
  edition?: string;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Claims a named job for `minutes`, so overlapping cron invocations cannot both run it. */
async function claimInterval(db: D1Database, jobId: string, now: number, minutes: number): Promise<boolean> {
  const stateId = 'live:' + jobId;
  const runAt = new Date(now).toISOString();
  await db.prepare('INSERT INTO source_state (source_id, next_due_at) VALUES (?, ?) ON CONFLICT(source_id) DO NOTHING').bind(stateId, runAt).run();
  const nextDueAt = new Date(now + minutes * MINUTE_MS).toISOString();
  const result = await db.prepare('UPDATE source_state SET last_attempt_at = ?, next_due_at = ? WHERE source_id = ? AND next_due_at <= ?').bind(runAt, nextDueAt, stateId, runAt).run();
  return result.meta.changes === 1;
}

async function retryLater(db: D1Database, jobId: string, now: number, minutes: number, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const retryAt = new Date(now + minutes * MINUTE_MS).toISOString();
  await db.prepare('UPDATE source_state SET last_error = ?, next_due_at = ? WHERE source_id = ?').bind(message, retryAt, 'live:' + jobId).run();
  console.error(JSON.stringify({ message: 'live-snapshot-failed', job: jobId, error: message }));
}

async function markSuccess(db: D1Database, jobId: string, now: number): Promise<void> {
  await db.prepare('UPDATE source_state SET last_success_at = ?, last_error = NULL WHERE source_id = ?').bind(new Date(now).toISOString(), 'live:' + jobId).run();
}

interface AttemptRow { code: string; attempted_at: string }

/** Points never tried first, then the least recently tried, so every point is refreshed in turn. */
export function nextForecastBatch(points: ForecastPointDefinition[], attempts: AttemptRow[], size = POINTS_PER_TICK): ForecastPointDefinition[] {
  const attemptedAt = new Map(attempts.map(row => [row.code, row.attempted_at]));
  const ordered = [...points].sort((a, b) => (attemptedAt.get(a.code) ?? '').localeCompare(attemptedAt.get(b.code) ?? '') || a.code.localeCompare(b.code));
  return ordered.slice(0, size);
}

export interface ForecastTickResult { attempted: number; succeeded: number; rateLimited: boolean; published: boolean }

function forecastStatements(db: D1Database, point: ForecastPointDefinition, result: Awaited<ReturnType<typeof fetchForecastPoint>>, attemptedAt: string): D1PreparedStatement {
  if (!result.result) {
    return db.prepare('INSERT INTO forecast_points (code, attempted_at) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET attempted_at = excluded.attempted_at').bind(point.code, attemptedAt);
  }
  const steps = result.result.steps as Array<{ at: string }>;
  const times = steps.map(step => step.at).sort();
  return db.prepare('INSERT INTO forecast_points (code, attempted_at, fetched_at, first_at, last_at, payload_json) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(code) DO UPDATE SET attempted_at = excluded.attempted_at, fetched_at = excluded.fetched_at, first_at = excluded.first_at, last_at = excluded.last_at, payload_json = excluded.payload_json')
    .bind(point.code, attemptedAt, result.result.fetchedAt, times[0], times[times.length - 1], JSON.stringify(result.result));
}

/** Fetches the next few forecast points one request at a time, stopping at the first rate-limit answer. */
export async function refreshForecastBatch(db: D1Database, now: number, dependencies: SnapshotDependencies = {}): Promise<ForecastTickResult> {
  const { fetcher = fetch, sleep = defaultSleep, points = POINTS } = dependencies;
  const attempts = await db.prepare('SELECT code, attempted_at FROM forecast_points').all<AttemptRow>();
  const batch = nextForecastBatch(points, attempts.results);
  const attemptedAt = new Date(now).toISOString();
  const statements: D1PreparedStatement[] = [];
  let succeeded = 0;
  let rateLimited = false;
  for (const [index, point] of batch.entries()) {
    if (index > 0) await sleep(REQUEST_GAP_MS);
    const result = await fetchForecastPoint(point, { fetcher, attempts: 1, sleep });
    if (result.rateLimited) { rateLimited = true; break; }
    if (result.result) succeeded++;
    statements.push(forecastStatements(db, point, result, attemptedAt));
  }
  if (statements.length > 0) await db.batch(statements);
  return { attempted: statements.length, succeeded, rateLimited, published: false };
}

interface PublishRow { code: string; fetched_at: string; first_at: string; last_at: string; payload_json: string }

/**
 * Publishes the stored forecast once enough points are fresh. Points are joined as already-serialised text, so no
 * 1 MB document is parsed inside the Worker. Points without a fresh forecast are listed so the page can borrow a neighbour.
 */
export async function publishForecast(db: D1Database, now: number, dependencies: SnapshotDependencies = {}): Promise<boolean> {
  const { points = POINTS, edition = EDITION } = dependencies;
  const cutoff = new Date(now - FORECAST_FRESH_HOURS * HOUR_MS).toISOString();
  const rows = await db.prepare('SELECT code, fetched_at, first_at, last_at, payload_json FROM forecast_points WHERE payload_json IS NOT NULL AND fetched_at > ? ORDER BY code').bind(cutoff).all<PublishRow>();
  if (rows.results.length < Math.ceil(points.length * MIN_FRESH_RATIO)) return false;
  const fresh = new Set(rows.results.map(row => row.code));
  const unavailable = points.filter(point => !fresh.has(point.code)).map(point => ({ code: point.code, lat: point.lat, lon: point.lon }));
  const header = {
    schemaVersion: 1, kind: 'forecast-snapshot', source: 'BMKG', sourceUrl: 'https://data.bmkg.go.id/prakiraan-cuaca/',
    attribution: 'Weather forecast data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika).', codeEdition: edition,
    fetchedAt: rows.results.map(row => row.fetched_at).sort()[0],
    validFrom: rows.results.map(row => row.first_at).sort()[0],
    validTo: rows.results.map(row => row.last_at).sort().reverse()[0],
    units: { t: '°C', hu: '%', tcc: '%', tp: 'mm', wd: 'degrees, direction the wind comes from', ws: 'km/h' },
    coverage: { requested: points.length, received: rows.results.length }
  };
  const text = JSON.stringify(header).slice(0, -1) + ',"points":[' + rows.results.map(row => row.payload_json).join(',') + '],"unavailable":' + JSON.stringify(unavailable) + '}';
  const validUntil = new Date(now + FORECAST_FRESH_HOURS * HOUR_MS).toISOString();
  await storePublication(db, LIVE_KEYS.forecast, text, new Date(now).toISOString(), validUntil);
  return true;
}

export async function refreshEarthquakes(db: D1Database, now: number, dependencies: SnapshotDependencies = {}): Promise<boolean> {
  const { fetcher = fetch } = dependencies;
  if (!await claimInterval(db, 'earthquakes', now, EARTHQUAKE_MINUTES - 1)) return false;
  try {
    const response = await fetcher(EARTHQUAKE_SOURCE_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('BMKG archive: HTTP ' + response.status);
    const generatedAt = new Date(now).toISOString();
    const archive = buildEarthquakeArchive(await response.json(), generatedAt);
    await storePublication(db, LIVE_KEYS.earthquakes, JSON.stringify(archive), generatedAt, new Date(now + 2 * HOUR_MS).toISOString());
    await markSuccess(db, 'earthquakes', now);
    return true;
  } catch (error) {
    await retryLater(db, 'earthquakes', now, 5, error);
    return false;
  }
}

export async function refreshHistory(db: D1Database, now: number, dependencies: SnapshotDependencies = {}): Promise<boolean> {
  const { fetcher = fetch, sleep = defaultSleep, points = POINTS, edition = EDITION } = dependencies;
  try {
    const { withHistory, ...history } = await buildHistory({ points, edition, fetcher, sleep, attempts: 1, batchGapMs: 1000, now: () => new Date(now) });
    void withHistory;
    await storePublication(db, LIVE_KEYS.history, JSON.stringify(history), new Date(now).toISOString(), new Date(now + 36 * HOUR_MS).toISOString());
    await markSuccess(db, 'history', now);
    return true;
  } catch (error) {
    await retryLater(db, 'history', now, HISTORY_RETRY_MINUTES, error);
    return false;
  }
}

export interface LiveRunResult { earthquakes: boolean; history: boolean; forecast?: ForecastTickResult }

/**
 * One tick of the second cron. History (13 requests) takes a tick of its own once a day; every other tick refreshes the
 * next forecast points and, every 15 minutes, republishes the whole forecast. Earthquakes add one request every 15 minutes.
 */
export async function runLiveSnapshots(db: D1Database, now = Date.now(), dependencies: SnapshotDependencies = {}): Promise<LiveRunResult> {
  const result: LiveRunResult = { earthquakes: false, history: false };
  result.earthquakes = await refreshEarthquakes(db, now, dependencies);
  if (await claimInterval(db, 'history', now, HISTORY_MINUTES)) {
    result.history = await refreshHistory(db, now, dependencies);
    return result;
  }
  if (!await claimInterval(db, 'forecast', now, 4)) return result;
  try {
    result.forecast = await refreshForecastBatch(db, now, dependencies);
    if (await claimInterval(db, 'forecast-publish', now, FORECAST_PUBLISH_MINUTES - 1)) {
      result.forecast.published = await publishForecast(db, now, dependencies);
    }
    await markSuccess(db, 'forecast', now);
  } catch (error) {
    await retryLater(db, 'forecast', now, 5, error);
  }
  return result;
}

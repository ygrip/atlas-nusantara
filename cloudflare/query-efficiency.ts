import type { DatasetType } from '../src/lib/data/ingestion/schema.ts';

const DAY_MS = 86_400_000;
const COUNT_CACHE_MS = 15 * 60_000;
const COUNT_KEY = 'internal/observation-counts';
const MAINTENANCE_KEY = 'maintenance:observation-retention';
const TYPES: DatasetType[] = ['warning', 'earthquake', 'incident', 'hazard'];
export type ObservationCounts = Record<DatasetType, number>;

function emptyCounts(): ObservationCounts {
  return { warning: 0, earthquake: 0, incident: 0, hazard: 0 };
}

function parseCachedCounts(value: string, sourceIds: string[]): ObservationCounts | undefined {
  try {
    const cached: unknown = JSON.parse(value);
    if (!cached || typeof cached !== 'object') return undefined;
    const { sources, counts } = cached as { sources?: unknown; counts?: unknown };
    if (!Array.isArray(sources) || sources.length !== sourceIds.length || sources.some((id, i) => id !== sourceIds[i])) return undefined;
    if (!counts || typeof counts !== 'object') return undefined;
    const values = counts as Record<string, unknown>;
    if (!TYPES.every(type => Number.isSafeInteger(values[type]) && (values[type] as number) >= 0)) return undefined;
    return Object.fromEntries(TYPES.map(type => [type, values[type]])) as ObservationCounts;
  } catch {
    return undefined;
  }
}

/** Cache only historical aggregates; warning validity and source freshness are always evaluated live. */
export async function readObservationCounts(db: D1Database, sourceIds: string[], now: number): Promise<ObservationCounts> {
  if (!sourceIds.length) return emptyCounts();
  const nowIso = new Date(now).toISOString();
  const previous = await db.prepare('SELECT payload_json FROM publications WHERE key = ? AND valid_until > ?')
    .bind(COUNT_KEY, nowIso).first<{ payload_json: string }>();
  if (previous) {
    const cached = parseCachedCounts(previous.payload_json, sourceIds);
    if (cached) return cached;
  }
  const cutoff = new Date(now - 30 * DAY_MS).toISOString();
  const filter = sourceIds.map(() => '?').join(',');
  const result = await db.prepare('SELECT kind, COUNT(*) AS count FROM observations WHERE first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?) AND source_id IN (' + filter + ') GROUP BY kind')
    .bind(cutoff, cutoff, ...sourceIds).all<{ kind: DatasetType; count: number }>();
  const counts = emptyCounts();
  for (const row of result.results) if (TYPES.includes(row.kind)) counts[row.kind] = row.count;
  const expires = new Date(now + COUNT_CACHE_MS).toISOString();
  await db.prepare('INSERT INTO publications (key, payload_json, generated_at, valid_until) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload_json = excluded.payload_json, generated_at = excluded.generated_at, valid_until = excluded.valid_until WHERE excluded.generated_at > publications.generated_at')
    .bind(COUNT_KEY, JSON.stringify({ sources: sourceIds, counts }), nowIso, expires).run();
  return counts;
}

/** Existing (source_id, last_seen_at, expires_at) index makes this a selective lookup. */
export async function countActiveWarnings(db: D1Database, lastSuccessAt: string, now: number): Promise<number> {
  const nowIso = new Date(now).toISOString();
  const cutoff = new Date(now - 30 * DAY_MS).toISOString();
  const result = await db.prepare("SELECT COUNT(*) AS count FROM observations WHERE source_id = 'bmkg-nowcast' AND kind = 'warning' AND last_seen_at = ? AND expires_at > ? AND first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?)")
    .bind(lastSuccessAt, nowIso, cutoff, cutoff).first<{ count: number }>();
  return result?.count ?? 0;
}

/** Once-daily archive retention, with an atomic lease across overlapping scheduler invocations. */
export async function cleanupExpiredObservations(db: D1Database, now: number): Promise<number> {
  const nowIso = new Date(now).toISOString();
  const nextDue = new Date(now + DAY_MS).toISOString();
  const claim = await db.prepare('INSERT INTO source_state (source_id, next_due_at) VALUES (?, ?) ON CONFLICT(source_id) DO UPDATE SET next_due_at = excluded.next_due_at WHERE source_state.next_due_at <= ? RETURNING source_id')
    .bind(MAINTENANCE_KEY, nextDue, nowIso).first<{ source_id: string }>();
  if (!claim) return 0;
  try {
    const cutoff = new Date(now - 365 * DAY_MS).toISOString();
    const result = await db.prepare('DELETE FROM observations WHERE first_seen_at <= ? OR (observed_at IS NOT NULL AND observed_at <= ?)')
      .bind(cutoff, cutoff).run();
    return result.meta.changes;
  } catch (error) {
    // Do not postpone an unsuccessful cleanup for a full day.
    await db.prepare('UPDATE source_state SET next_due_at = ? WHERE source_id = ? AND next_due_at = ?')
      .bind(new Date(now + 5 * 60_000).toISOString(), MAINTENANCE_KEY, nextDue).run();
    throw error;
  }
}

// Per-source hazard schedule. Each source runs when its own interval is due (scripts/pipeline/sources/registry.mjs),
// stores cleaned events in D1, then re-aggregates them into a bounded D1 JSON publication.
// Disabled unless HAZARD_SOURCE_IDS lists the sources an operator has reviewed (PetaBencana is CC BY-NC).
import regionRecords from './generated/regions.json' with { type: 'json' };
import { storePublication } from './publication.ts';
import { createGazetteer } from '../scripts/pipeline/lib/gazetteer-core.mjs';
import { buildSnapshot, fitSnapshot } from '../scripts/pipeline/lib/aggregate.mjs';
import { reaggregate, retentionMap } from '../scripts/pipeline/lib/schedule.mjs';
import { EVENT_SOURCES } from '../scripts/pipeline/sources/registry.mjs';
import { BMKG_CAP, CAP_INTERVAL_MINUTES, collectBmkgCap } from '../scripts/pipeline/sources/bmkg-cap.mjs';

const MINUTE_MS = 60_000;
const RETRY_AFTER_FAILURE_MINUTES = 10;
const MAX_STORED_ROWS = 3000;
const SNAPSHOT_KEY = 'data/observations/hazards.json';
const STATE_PREFIX = 'hazard:';

export interface HazardEnv {
  DB: D1Database;
  HAZARD_SOURCE_IDS?: string;
}

/** What one scheduled source needs: a name, an interval and a collector. The CAP warnings use the same shape. */
export interface ScheduledHazardSource {
  id: string;
  intervalMinutes: number;
  retentionDays: number;
  sourceName: string;
  kind: 'event' | 'warning';
  collect(context: CollectContext): Promise<CollectResult>;
}

interface CollectContext { gazetteer: unknown; now: number; fetchedAt: string }
interface CollectResult { events?: StoredEvent[]; warnings?: StoredWarning[]; fetched: number; rejected: Record<string, number> }
interface StoredEvent { id: string; source: string; occurredAt: string; [key: string]: unknown }
interface StoredWarning { id: string; expires: string; effective: string; [key: string]: unknown }

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function enabledHazardIds(env: Pick<HazardEnv, 'HAZARD_SOURCE_IDS'>): Set<string> {
  return new Set((env.HAZARD_SOURCE_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean));
}

export function defaultHazardSources(): ScheduledHazardSource[] {
  const events: ScheduledHazardSource[] = EVENT_SOURCES.map(source => ({
    id: source.meta.id, intervalMinutes: source.intervalMinutes, retentionDays: source.retentionDays, sourceName: source.meta.name, kind: 'event' as const,
    collect: (context: CollectContext) => source.run(context) as Promise<CollectResult>
  }));
  const warnings: ScheduledHazardSource = {
    id: BMKG_CAP.id, intervalMinutes: CAP_INTERVAL_MINUTES, retentionDays: 1, sourceName: BMKG_CAP.name, kind: 'warning',
    collect: (context: CollectContext) => collectBmkgCap(context) as unknown as Promise<CollectResult>
  };
  return [...events, warnings];
}

/** Claims the source for this run so overlapping cron invocations cannot both fetch it. */
async function claim(db: D1Database, source: ScheduledHazardSource, now: number): Promise<boolean> {
  const stateId = STATE_PREFIX + source.id;
  const runAt = new Date(now).toISOString();
  await db.prepare('INSERT INTO source_state (source_id, next_due_at) VALUES (?, ?) ON CONFLICT(source_id) DO NOTHING').bind(stateId, runAt).run();
  const nextDueAt = new Date(now + source.intervalMinutes * MINUTE_MS).toISOString();
  const result = await db.prepare('UPDATE source_state SET last_attempt_at = ?, next_due_at = ? WHERE source_id = ? AND next_due_at <= ?').bind(runAt, nextDueAt, stateId, runAt).run();
  return result.meta.changes === 1;
}

function eventStatements(db: D1Database, source: ScheduledHazardSource, events: StoredEvent[], runAt: string): D1PreparedStatement[] {
  const insert = 'INSERT INTO hazard_events (id, source_id, kind, occurred_at, expires_at, last_seen_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, last_seen_at = excluded.last_seen_at, occurred_at = excluded.occurred_at';
  return events.map(event => db.prepare(insert).bind(event.id, source.id, 'event', event.occurredAt, null, runAt, JSON.stringify(event)));
}

function warningStatements(db: D1Database, source: ScheduledHazardSource, warnings: StoredWarning[], runAt: string): D1PreparedStatement[] {
  const statements = [db.prepare("DELETE FROM hazard_events WHERE source_id = ? AND kind = 'warning'").bind(source.id)];
  const insert = 'INSERT INTO hazard_events (id, source_id, kind, occurred_at, expires_at, last_seen_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)';
  for (const warning of warnings) {
    statements.push(db.prepare(insert).bind(warning.id, source.id, 'warning', warning.effective, warning.expires, runAt, JSON.stringify(warning)));
  }
  return statements;
}

async function runOne(db: D1Database, source: ScheduledHazardSource, context: CollectContext): Promise<'ok' | 'failed'> {
  const stateId = STATE_PREFIX + source.id;
  const runAt = context.fetchedAt;
  try {
    const result = await source.collect(context);
    const statements: D1PreparedStatement[] = [];
    let count = 0;
    if (source.kind === 'warning') {
      const warnings = result.warnings ?? [];
      count = warnings.length;
      statements.push(...warningStatements(db, source, warnings, runAt));
    } else {
      const events = result.events ?? [];
      count = events.length;
      statements.push(...eventStatements(db, source, events, runAt));
      const cutoff = new Date(context.now - source.retentionDays * 86_400_000).toISOString();
      statements.push(db.prepare("DELETE FROM hazard_events WHERE source_id = ? AND kind = 'event' AND occurred_at < ?").bind(source.id, cutoff));
    }
    statements.push(db.prepare('UPDATE source_state SET last_success_at = ?, last_error = NULL, last_record_count = ? WHERE source_id = ?').bind(runAt, count, stateId));
    await db.batch(statements);
    return 'ok';
  } catch (error) {
    const message = errorText(error).slice(0, 500);
    const retryAt = new Date(context.now + Math.min(source.intervalMinutes, RETRY_AFTER_FAILURE_MINUTES) * MINUTE_MS).toISOString();
    await db.prepare('UPDATE source_state SET last_error = ?, next_due_at = ? WHERE source_id = ?').bind(message, retryAt, stateId).run();
    console.error(JSON.stringify({ message: 'hazard-source-failed', source: source.id, error: message }));
    return 'failed';
  }
}

interface StoredRow { source_id: string; kind: string; payload_json: string }
interface StateRow { source_id: string; last_success_at: string | null; last_error: string | null; last_record_count: number }

/** Re-aggregates everything stored (today's data included) into one snapshot, newest first, within each source's retention. */
export async function buildStoredSnapshot(db: D1Database, sources: ScheduledHazardSource[], now: number): Promise<{ text: string; eventCount: number; warningCount: number } | undefined> {
  const rows = await db.prepare('SELECT source_id, kind, payload_json FROM hazard_events ORDER BY occurred_at DESC LIMIT ?').bind(MAX_STORED_ROWS).all<StoredRow>();
  const states = await db.prepare("SELECT source_id, last_success_at, last_error, last_record_count FROM source_state WHERE source_id LIKE 'hazard:%'").all<StateRow>();
  const storedEvents = rows.results.filter(row => row.kind === 'event').map(row => JSON.parse(row.payload_json) as StoredEvent);
  const warnings = rows.results.filter(row => row.kind === 'warning').map(row => JSON.parse(row.payload_json) as StoredWarning).filter(warning => Date.parse(warning.expires) > now);
  const eventSources = sources.filter(source => source.kind === 'event');
  const retention = retentionMap(EVENT_SOURCES.filter(source => eventSources.some(enabled => enabled.id === source.meta.id)));
  const events = reaggregate(storedEvents, [], retention, now);
  const metas = EVENT_SOURCES.filter(source => eventSources.some(enabled => enabled.id === source.meta.id)).map(source => source.meta);
  const statuses = sources.map(source => {
    const state = states.results.find(row => row.source_id === STATE_PREFIX + source.id);
    let status = 'not-run';
    if (state?.last_success_at) status = 'ok';
    if (state?.last_error) status = 'failed';
    return { id: source.id, name: source.sourceName, status, fetched: 0, kept: state?.last_record_count ?? 0, rejected: {}, lastSuccessAt: state?.last_success_at ?? undefined, ...(state?.last_error ? { error: state.last_error } : {}) };
  });
  const enabledStateIds = new Set(sources.map(source => STATE_PREFIX + source.id));
  const successfulTimes = states.results
    .filter(state => enabledStateIds.has(state.source_id))
    .map(state => Date.parse(state.last_success_at ?? ''))
    .filter(timestamp => Number.isFinite(timestamp) && timestamp <= now);
  if (successfulTimes.length === 0) return undefined;
  const fetchedAt = new Date(Math.max(...successfulTimes)).toISOString();
  const snapshot = buildSnapshot({
    fetchedAt,
    warnings: { source: BMKG_CAP.name, sourceUrl: BMKG_CAP.url, termsUrl: BMKG_CAP.termsUrl, attribution: BMKG_CAP.attribution, coverage: warnings.length + ' active.', items: warnings },
    sourceMetas: metas, events, statuses
  });
  const fitted = fitSnapshot(snapshot);
  return { text: fitted.text, eventCount: fitted.snapshot.events.items.length, warningCount: warnings.length };
}

async function publish(db: D1Database, text: string, now: number): Promise<void> {
  const generatedAt = new Date(now).toISOString();
  const validUntil = new Date(now + 15 * MINUTE_MS).toISOString();
  await storePublication(db, SNAPSHOT_KEY, text, generatedAt, validUntil);
}

export interface HazardRunResult { ran: string[]; failed: string[]; published: boolean; events: number; warnings: number }

/** Collect due sources, then refresh the stored projection without changing collection timestamps. */
export async function runHazardSchedule(env: HazardEnv, now = Date.now(), sources: ScheduledHazardSource[] = defaultHazardSources()): Promise<HazardRunResult> {
  const enabledIds = enabledHazardIds(env);
  const enabled = sources.filter(source => enabledIds.has(source.id));
  const result: HazardRunResult = { ran: [], failed: [], published: false, events: 0, warnings: 0 };
  if (enabled.length === 0) return result;
  const context: CollectContext = { gazetteer: createGazetteer(regionRecords as Parameters<typeof createGazetteer>[0]), now, fetchedAt: new Date(now).toISOString() };
  for (const source of enabled) {
    if (!await claim(env.DB, source, now)) continue;
    const outcome = await runOne(env.DB, source, context);
    if (outcome === 'ok') result.ran.push(source.id);
    else result.failed.push(source.id);
  }
  const built = await buildStoredSnapshot(env.DB, enabled, now);
  if (!built) return result;
  await publish(env.DB, built.text, now);
  result.published = true;
  result.events = built.eventCount;
  result.warnings = built.warningCount;
  return result;
}

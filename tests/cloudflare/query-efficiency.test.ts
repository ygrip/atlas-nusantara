import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cleanupExpiredObservations, countActiveWarnings, readObservationCounts } from '../../cloudflare/query-efficiency.ts';

const now = Date.parse('2026-11-06T00:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function createDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE source_state (source_id TEXT PRIMARY KEY, next_due_at TEXT NOT NULL);
    CREATE TABLE observations (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL, kind TEXT NOT NULL, observed_at TEXT,
      expires_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT, payload_json TEXT NOT NULL
    );
    CREATE INDEX observations_current_warning ON observations(source_id,last_seen_at,expires_at);
    CREATE INDEX observations_expiry ON observations(first_seen_at);
    CREATE TABLE publications (key TEXT PRIMARY KEY,payload_json TEXT NOT NULL,generated_at TEXT NOT NULL,valid_until TEXT NOT NULL);
  `);
  const seen: string[] = [];
  function statement(sql: string, args: unknown[] = []) {
    return {
      bind(...values: unknown[]) { return statement(sql, values); },
      async first<T>() { seen.push(sql); return (sqlite.prepare(sql).get(...(args as never[])) ?? null) as T | null; },
      async all<T>() { seen.push(sql); return { results: sqlite.prepare(sql).all(...(args as never[])) as T[] }; },
      async run() { seen.push(sql); const result = sqlite.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(result.changes) } }; }
    };
  }
  return { sqlite, seen, db: { prepare: (sql: string) => statement(sql) } as unknown as D1Database };
}
function insert(db: DatabaseSync, id: string, source: string, kind: string, first: number, observed: number | null, expiry: number | null, seen: number | null = null) {
  db.prepare('INSERT INTO observations (id,source_id,kind,first_seen_at,observed_at,expires_at,last_seen_at,payload_json) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, source, kind, new Date(first).toISOString(), observed === null ? null : new Date(observed).toISOString(), expiry === null ? null : new Date(expiry).toISOString(), seen === null ? null : new Date(seen).toISOString(), JSON.stringify({ id }));
}

test('historical summary counts are cached for fifteen minutes and source changes invalidate cache', async () => {
  const { sqlite, seen, db } = createDatabase();
  insert(sqlite, 'a', 'bmkg-nowcast', 'warning', now - DAY, now - DAY, now + HOUR, now);
  insert(sqlite, 'b', 'bmkg-nowcast', 'warning', now - 31 * DAY, now - DAY, now + HOUR, now);
  insert(sqlite, 'c', 'bmkg-earthquakes', 'earthquake', now - DAY, now - DAY, null);
  insert(sqlite, 'd', 'bmkg-nowcast', 'warning', now - DAY, now - 31 * DAY, now + HOUR, now);
  const sources = ['bmkg-earthquakes', 'bmkg-nowcast'];
  assert.deepEqual(await readObservationCounts(db, sources, now), { warning: 1, earthquake: 1, incident: 0, hazard: 0 });
  assert.equal(seen.filter(sql => sql.includes('GROUP BY kind')).length, 1);
  insert(sqlite, 'e', 'bmkg-nowcast', 'warning', now, now, now + HOUR, now);
  assert.equal((await readObservationCounts(db, sources, now + 5 * 60_000)).warning, 1);
  assert.equal(seen.filter(sql => sql.includes('GROUP BY kind')).length, 1);
  assert.equal((await readObservationCounts(db, sources, now + 15 * 60_000)).warning, 2);
  assert.equal(seen.filter(sql => sql.includes('GROUP BY kind')).length, 2);
  assert.deepEqual(await readObservationCounts(db, ['bmkg-earthquakes'], now + 16 * 60_000), { warning: 0, earthquake: 1, incident: 0, hazard: 0 });
  assert.equal(seen.filter(sql => sql.includes('GROUP BY kind')).length, 3);
  assert.equal((await readObservationCounts(db, [], now)).warning, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM publications WHERE key = ?').get('internal/observation-counts')?.n, 1);
});

test('active warnings count only fresh current nowcast records using existing composite index', async () => {
  const { sqlite, db } = createDatabase();
  const lastSeen = now - 60_000;
  insert(sqlite, 'valid', 'bmkg-nowcast', 'warning', now - DAY, now - HOUR, now + HOUR, lastSeen);
  insert(sqlite, 'expired', 'bmkg-nowcast', 'warning', now - DAY, now - HOUR, now - 1, lastSeen);
  insert(sqlite, 'old-run', 'bmkg-nowcast', 'warning', now - DAY, now - HOUR, now + HOUR, now - 2 * HOUR);
  insert(sqlite, 'old-observed', 'bmkg-nowcast', 'warning', now - DAY, now - 40 * DAY, now + HOUR, lastSeen);
  insert(sqlite, 'earthquake', 'bmkg-nowcast', 'earthquake', now - DAY, now - HOUR, now + HOUR, lastSeen);
  insert(sqlite, 'other-source', 'another-provider', 'warning', now - DAY, now - HOUR, now + HOUR, lastSeen);
  assert.equal(await countActiveWarnings(db, new Date(lastSeen).toISOString(), now), 1);
  const plan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM observations WHERE source_id = 'bmkg-nowcast' AND kind = 'warning' AND last_seen_at = ? AND expires_at > ? AND first_seen_at > ? AND (observed_at IS NULL OR observed_at > ?)")
    .all(new Date(lastSeen).toISOString(),new Date(now).toISOString(),new Date(now-30*DAY).toISOString(),new Date(now-30*DAY).toISOString()) as Array<{detail:string}>;
  assert.ok(plan.some(row => row.detail.includes('USING INDEX observations_current_warning')), JSON.stringify(plan));
});

test('retention cleanup runs once per day and preserves one-year history until due', async () => {
  const { sqlite, seen, db } = createDatabase();
  insert(sqlite, 'old-first', 'bmkg-nowcast', 'warning', now - 366 * DAY, now - 20 * DAY, null);
  insert(sqlite, 'old-observed', 'bmkg-nowcast', 'warning', now - DAY, now - 366 * DAY, null);
  insert(sqlite, 'keep', 'bmkg-nowcast', 'warning', now - 360 * DAY, now - 360 * DAY, null);
  assert.equal(await cleanupExpiredObservations(db, now), 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM observations').get()?.n, 1);
  assert.equal(await cleanupExpiredObservations(db, now + HOUR), 0);
  assert.equal(seen.filter(sql => sql.startsWith('DELETE FROM observations')).length, 1);
  assert.equal(await cleanupExpiredObservations(db, now + DAY), 0);
  assert.equal(seen.filter(sql => sql.startsWith('DELETE FROM observations')).length, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM source_state WHERE source_id = ?').get('maintenance:observation-retention')?.n, 1);
});

test('an unsuccessful cleanup retries in five minutes instead of losing the next 24 hours', async () => {
  const { sqlite, db } = createDatabase();
  const failed = { prepare(sql: string) {
    if (sql.startsWith('DELETE FROM observations')) return { bind() { return { async run() { throw Error('simulated failure'); } }; } };
    return db.prepare(sql);
  } } as unknown as D1Database;
  await assert.rejects(cleanupExpiredObservations(failed, now), /simulated failure/);
  assert.equal(await cleanupExpiredObservations(db, now + 60_000), 0);
  assert.equal(await cleanupExpiredObservations(db, now + 5 * 60_000), 0);
  assert.equal(sqlite.prepare('SELECT next_due_at FROM source_state WHERE source_id = ?').get('maintenance:observation-retention')?.next_due_at, new Date(now + 5 * 60_000 + DAY).toISOString());
});

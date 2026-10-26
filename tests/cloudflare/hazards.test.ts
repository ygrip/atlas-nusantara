import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { buildStoredSnapshot, enabledHazardIds, runHazardSchedule, type ScheduledHazardSource } from '../../cloudflare/hazards.ts';

const now = Date.parse('2026-10-27T06:00:00Z');

/** Minimal D1 shim over node:sqlite: enough for prepare/bind/run/all/first/batch. */
function createDatabase(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  sqlite.exec(readFileSync('cloudflare/migrations/0004_hazard_events.sql', 'utf8'));
  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...bound: unknown[]) { return statement(sql, bound); },
      async run() { const result = sqlite.prepare(sql).run(...(values as never[])); return { meta: { changes: Number(result.changes) } }; },
      async all() { return { results: sqlite.prepare(sql).all(...(values as never[])) }; },
      async first() { return sqlite.prepare(sql).get(...(values as never[])) ?? null; },
      exec() { return sqlite.prepare(sql).run(...(values as never[])); }
    };
  }
  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: Array<{ exec(): unknown }>) { sqlite.exec('BEGIN'); try { for (const item of statements) item.exec(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; } return []; }
  } as unknown as D1Database;
}

function createBucket() {
  const objects = new Map<string, string>();
  return { objects, bucket: { async put(key: string, value: string) { objects.set(key, value); } } as unknown as R2Bucket };
}

function event(id: string, source: string, hoursAgo: number) {
  return { id, kind: 'official', source, type: 'flood', title: 'Banjir ' + id, occurredAt: new Date(now - hoursAgo * 3_600_000).toISOString(), place: 'Agam' };
}

function warning(id: string, expiresInMinutes: number) {
  const base = { id, event: 'Hujan Lebat', headline: 'Hujan lebat ' + id, description: 'x', severity: 'Moderate', urgency: 'Immediate', certainty: 'Observed', areaDescriptions: 'Jakarta', sourceLink: 'https://www.bmkg.go.id/alerts/nowcast/id/X_alert.xml', centroid: { lon: 106.8, lat: -6.2 } };
  return { ...base, effective: new Date(now - 600_000).toISOString(), expires: new Date(now + expiresInMinutes * 60_000).toISOString() };
}

function fakeSources(calls: string[]): ScheduledHazardSource[] {
  return [
    { id: 'bnpb', intervalMinutes: 180, retentionDays: 60, sourceName: 'BNPB DIBI', kind: 'event', async collect() { calls.push('bnpb'); return { events: [event('bnpb:1', 'BNPB DIBI', 5), event('bnpb:old', 'BNPB DIBI', 24 * 90)], fetched: 2, rejected: {} }; } },
    { id: 'petabencana', intervalMinutes: 10, retentionDays: 7, sourceName: 'PetaBencana.id', kind: 'event', async collect() { calls.push('petabencana'); return { events: [event('petabencana:1', 'PetaBencana.id', 1)], fetched: 1, rejected: {} }; } },
    { id: 'bmkg-cap', intervalMinutes: 5, retentionDays: 1, sourceName: 'BMKG', kind: 'warning', async collect() { calls.push('bmkg-cap'); return { warnings: [warning('cap:live', 60), warning('cap:gone', -5)], fetched: 2, rejected: {} }; } }
  ];
}

test('nothing runs and nothing is published until an operator enables hazard sources', async () => {
  const calls: string[] = [];
  const { bucket, objects } = createBucket();
  const result = await runHazardSchedule({ DB: createDatabase(), HOT_DATA: bucket }, now, fakeSources(calls));
  assert.deepEqual(result, { ran: [], failed: [], published: false, events: 0, warnings: 0 });
  assert.equal(calls.length, 0);
  assert.equal(objects.size, 0);
  assert.deepEqual([...enabledHazardIds({ HAZARD_SOURCE_IDS: ' bnpb, ,petabencana ' })], ['bnpb', 'petabencana']);
});

test('each source runs on its own interval and the stored data is re-aggregated', async () => {
  const db = createDatabase();
  const { bucket, objects } = createBucket();
  const env = { DB: db, HOT_DATA: bucket, HAZARD_SOURCE_IDS: 'bnpb,petabencana,bmkg-cap' };
  const calls: string[] = [];
  const sources = fakeSources(calls);

  const first = await runHazardSchedule(env, now, sources);
  assert.deepEqual(first.ran.sort(), ['bmkg-cap', 'bnpb', 'petabencana']);
  assert.equal(first.published, true);
  const published = JSON.parse(objects.get('data/observations/hazards.json') as string);
  assert.equal(published.schemaVersion, 2);
  assert.deepEqual(published.events.items.map((item: { id: string }) => item.id), ['petabencana:1', 'bnpb:1']);
  assert.deepEqual(published.warnings.items.map((item: { id: string }) => item.id), ['cap:live']);

  calls.length = 0;
  await runHazardSchedule(env, now + 6 * 60_000, sources);
  assert.deepEqual(calls, ['bmkg-cap']);

  calls.length = 0;
  const later = await runHazardSchedule(env, now + 12 * 60_000, sources);
  assert.deepEqual(calls.sort(), ['bmkg-cap', 'petabencana']);
  assert.equal(later.events, 2);

  calls.length = 0;
  await runHazardSchedule(env, now + 181 * 60_000, sources);
  assert.ok(calls.includes('bnpb'));
});

test('a failing source keeps its stored events, is retried within ten minutes and is reported', async () => {
  const db = createDatabase();
  const { bucket, objects } = createBucket();
  const env = { DB: db, HOT_DATA: bucket, HAZARD_SOURCE_IDS: 'bnpb,petabencana' };
  const sources = fakeSources([]);
  await runHazardSchedule(env, now, sources);
  let broken = true;
  sources[0].collect = async () => { if (broken) throw Error('layout changed'); return { events: [], fetched: 0, rejected: {} }; };
  const failed = await runHazardSchedule(env, now + 181 * 60_000, sources);
  assert.deepEqual(failed.failed, ['bnpb']);
  assert.deepEqual(failed.ran, ['petabencana']);
  const stored = await buildStoredSnapshot(db, sources.filter(source => source.kind === 'event'), now + 181 * 60_000);
  const snapshot = JSON.parse(stored.text);
  assert.ok(snapshot.events.items.some((item: { id: string }) => item.id === 'bnpb:1'));
  assert.equal(snapshot.pipeline.sources.find((item: { id: string }) => item.id === 'bnpb').status, 'failed');
  broken = false;
  const retried = await runHazardSchedule(env, now + 192 * 60_000, sources);
  assert.deepEqual(retried.ran.sort(), ['bnpb', 'petabencana']);
  assert.ok(objects.size > 0);
});

test('events outside their source retention are dropped from storage and from the snapshot', async () => {
  const db = createDatabase();
  const { bucket, objects } = createBucket();
  const env = { DB: db, HOT_DATA: bucket, HAZARD_SOURCE_IDS: 'bnpb' };
  await runHazardSchedule(env, now, fakeSources([]));
  const ids = JSON.parse(objects.get('data/observations/hazards.json') as string).events.items.map((item: { id: string }) => item.id);
  assert.ok(ids.includes('bnpb:1'));
  assert.ok(!ids.includes('bnpb:old'));
  const row = await db.prepare("SELECT COUNT(*) AS count FROM hazard_events WHERE id = 'bnpb:old'").first<{ count: number }>();
  assert.equal(row?.count, 0);
});

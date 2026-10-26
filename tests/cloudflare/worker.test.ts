import test from 'node:test';
import assert from 'node:assert/strict';
import { enabledSources, retentionCutoff, SOURCE_REGISTRY, sourceStatus } from '../../cloudflare/worker.ts';
import { createExportResponse, csvCell } from '../../cloudflare/export.ts';

const now = Date.parse('2026-10-26T12:00:00.000Z');

test('source registry assigns independent schedules and never configures unverified providers', () => {
  const ids = SOURCE_REGISTRY.map(source => source.id);
  assert.equal(new Set(ids).size, ids.length);
  const earthquake = SOURCE_REGISTRY.find(source => source.id === 'bmkg-earthquakes');
  const cap = SOURCE_REGISTRY.find(source => source.id === 'bmkg-nowcast');
  assert.equal(earthquake?.intervalMinutes, 15);
  assert.equal(cap?.intervalMinutes, 5);
  assert.deepEqual(enabledSources({ APPROVED_SOURCE_IDS: '' } as Partial<Env>), []);
  assert.equal(SOURCE_REGISTRY.find(source => source.id === 'bnpb-incidents')?.enabled, false);
});

test('explicit redistribution review and activation are both required', () => {
  const unreviewed = { APPROVED_SOURCE_IDS: 'bmkg-earthquakes' } as Partial<Env>;
  assert.deepEqual(enabledSources(unreviewed), []);
  const approved = {
    APPROVED_SOURCE_IDS: 'bmkg-earthquakes',
    BMKG_EARTHQUAKES_LICENSE: 'CC-BY-4.0',
    BMKG_EARTHQUAKES_LICENSE_URL: 'https://data.bmkg.go.id/gempabumi/',
    BMKG_EARTHQUAKES_REVIEWED_BY: 'repository maintainer',
    BMKG_EARTHQUAKES_REVIEWED_AT: '2026-10-26T12:00:00.000Z'
  } as Partial<Env>;
  assert.deepEqual(enabledSources(approved).map(source => source.id), ['bmkg-earthquakes']);
  assert.equal(enabledSources({ ...approved, BMKG_EARTHQUAKES_LICENSE_URL: 'http://example.test' } as Partial<Env>).length, 0);
});

test('one-year retention uses first-seen timestamps and excludes exactly one-year-old records', () => {
  assert.equal(retentionCutoff(now), '2025-10-26T12:00:00.000Z');
});

test('CSV output quotes fields and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('=IMPORTXML("x")'), "\"'=IMPORTXML(\"\"x\"\")\"");
  assert.equal(csvCell('plain, "quoted"'), '"plain, ""quoted"""');
  assert.equal(csvCell('-2'), "\"'-2\"");
});

test('JSON exports stream metadata and keyset-page retained records without cache', async () => {
  let sql = '';
  const db = {
    prepare(statement: string) {
      sql = statement;
      return { bind() { return { async all<T>() { const results: T[] = []; return { results }; } }; } };
    }
  };
  const response = createExportResponse(db, 'warning', 'json', ['bmkg-nowcast'], now);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json() as { retentionDays: number; scope: string; records: unknown[] };
  assert.match(sql, /ORDER BY COALESCE\(observed_at, first_seen_at\), id LIMIT 500/);
  assert.doesNotMatch(sql, /OFFSET/);
  assert.equal(payload.retentionDays, 365);
  assert.match(payload.scope, /historical archive/);
  assert.deepEqual(payload.records, []);
});

test('source status distinguishes never-run, failing, healthy and stale sources', () => {
  const source = SOURCE_REGISTRY[0];
  assert.equal(sourceStatus(source, undefined, now), 'not-configured');
  assert.equal(sourceStatus({ ...source, enabled: false }, undefined, now), 'disabled');
  assert.equal(sourceStatus(source, { last_success_at: null, last_error: null }, now), 'never-run');
  assert.equal(sourceStatus(source, { last_success_at: null, last_error: 'denied' }, now), 'error');
  assert.equal(sourceStatus(source, { last_success_at: '2026-10-26T11:50:00.000Z', last_error: null }, now), 'healthy');
  assert.equal(sourceStatus(source, { last_success_at: '2026-10-26T00:00:00.000Z', last_error: null }, now), 'stale');
});

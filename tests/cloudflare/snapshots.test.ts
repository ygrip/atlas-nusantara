import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expectedLastHistoryDay, nextForecastBatch, POINTS_PER_TICK, publishForecast, refreshEarthquakes, refreshForecastBatch, refreshHistory, runLiveSnapshots, type ForecastPointDefinition } from '../../cloudflare/snapshots.ts';
import { liveKeyForPath, LIVE_KEYS } from '../../cloudflare/live-snapshots.ts';
import { CODE_EDITION } from '../../src/lib/atlas/edition.ts';

// The page's validators import browser-only modules, so they are loaded by a computed path to keep them out of the Worker type-check.
async function validators(): Promise<{ isForecastSnapshot(value: unknown): boolean; isWeatherHistory(value: unknown): boolean; isEarthquakeArchive(value: unknown): boolean }> {
  const load = (path: string) => import(path);
  const [weather, history, earthquakes] = await Promise.all([load('../../src/lib/map/weather.ts'), load('../../src/lib/data/weather-history-contract.ts'), load('../../src/lib/data/earthquakes.ts')]);
  return { isForecastSnapshot: weather.isForecastSnapshot, isWeatherHistory: history.isWeatherHistory, isEarthquakeArchive: earthquakes.isEarthquakeArchive };
}

const now = Date.parse('2026-10-29T03:00:00Z');
const noSleep = async () => {};

function createDatabase(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_initial.sql', '0005_publications.sql', '0007_forecast_points.sql', '0008_live_change_tracking.sql']) sqlite.exec(readFileSync('cloudflare/migrations/' + file, 'utf8'));
  function statement(sql: string, values: unknown[] = []) {
    return {
      bind(...bound: unknown[]) { return statement(sql, bound); },
      async run() { const result = sqlite.prepare(sql).run(...(values as never[])); return { meta: { changes: Number(result.changes) } }; },
      async all() { return { results: sqlite.prepare(sql).all(...(values as never[])) }; },
      async first() { return sqlite.prepare(sql).get(...(values as never[])) ?? null; },
      exec() { return sqlite.prepare(sql).run(...(values as never[])); }
    };
  }
  const db = {
    prepare: (sql: string) => statement(sql),
    async batch(statements: Array<{ exec(): unknown }>) { sqlite.exec('BEGIN'); try { for (const item of statements) item.exec(); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; } return []; }
  } as unknown as D1Database;
  return { db, sqlite };
}

function pointList(count: number): ForecastPointDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const code = '11.' + String(index + 1).padStart(2, '0');
    return { code, adm4: code + '.01.1001', expectedName: 'Kabupaten Kota ' + index, lat: 3 + index / 100, lon: 97 + index / 100 };
  });
}

/** A fake BMKG: answers for each adm4 with a matching region, except the codes in `failing` (HTTP 500) and `limited` (HTTP 429). */
function fakeBmkg(points: ForecastPointDefinition[], requests: string[], failing = new Set<string>(), limited = new Set<string>()): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const adm4 = new URL(url).searchParams.get('adm4');
    const point = points.find(item => item.adm4 === adm4);
    if (!point) return new Response('{}', { status: 404 });
    if (failing.has(point.code)) return new Response('{}', { status: 500 });
    if (limited.has(point.code)) return new Response('{}', { status: 429 });
    const at = new Date(now + 3_600_000).toISOString();
    const step = { datetime: at, t: 27, hu: 80, tcc: 40, tp: 0, weather: 1, weather_desc_en: 'Sunny', wd_deg: 90, ws: 5 };
    return Response.json({ lokasi: { adm2: point.code, kotkab: point.expectedName, lon: point.lon, lat: point.lat }, data: [{ cuaca: [[step]] }] });
  }) as typeof fetch;
}

test('the next batch tries never-attempted points first, then the least recently attempted', () => {
  const points = pointList(5);
  const batch = nextForecastBatch(points, [{ code: '11.01', attempted_at: '2026-10-29T02:00:00Z' }, { code: '11.02', attempted_at: '2026-10-29T01:00:00Z' }], 4);
  assert.deepEqual(batch.map(point => point.code), ['11.03', '11.04', '11.05', '11.02']);
});

test('forecast refresh stores each point, rotates through all of them and stops at a rate limit', async () => {
  const points = pointList(45);
  const requests: string[] = [];
  const { db, sqlite } = createDatabase();
  const first = await refreshForecastBatch(db, now, { fetcher: fakeBmkg(points, requests), sleep: noSleep, points });
  assert.deepEqual({ attempted: first.attempted, succeeded: first.succeeded, rateLimited: first.rateLimited }, { attempted: POINTS_PER_TICK, succeeded: POINTS_PER_TICK, rateLimited: false });
  assert.equal(requests.length, POINTS_PER_TICK);
  // The 15 never-tried points come first, then the cycle wraps to the least recently tried.
  const second = await refreshForecastBatch(db, now + 1_200_000, { fetcher: fakeBmkg(points, requests, new Set(['11.41'])), sleep: noSleep, points });
  assert.equal(second.attempted, POINTS_PER_TICK);
  assert.equal(second.succeeded, POINTS_PER_TICK - 1);
  const count = sqlite.prepare('SELECT COUNT(*) AS count FROM forecast_points').get() as { count: number };
  assert.equal(count.count, 45);
  const failed = sqlite.prepare('SELECT payload_json FROM forecast_points WHERE code = ?').get('11.41') as { payload_json: string | null };
  assert.equal(failed.payload_json, null);
  const limited = await refreshForecastBatch(db, now + 2_400_000, { fetcher: fakeBmkg(points, requests, new Set(), new Set(['11.20'])), sleep: noSleep, points });
  assert.equal(limited.rateLimited, true);
  assert.ok(limited.attempted < POINTS_PER_TICK);
});

test('a forecast is published only when enough points are fresh, lists the missing ones and passes the page validation', async () => {
  const points = pointList(45);
  const { db, sqlite } = createDatabase();
  const dependencies = { fetcher: fakeBmkg(points, [], new Set(['11.41'])), sleep: noSleep, points, edition: CODE_EDITION };
  await refreshForecastBatch(db, now, dependencies);
  assert.equal(await publishForecast(db, now, dependencies), false);
  await refreshForecastBatch(db, now + 1, dependencies);
  assert.equal(await publishForecast(db, now + 3, dependencies), true);
  const row = sqlite.prepare('SELECT payload_json, valid_until FROM publications WHERE key = ?').get(LIVE_KEYS.forecast) as { payload_json: string; valid_until: string };
  const snapshot = JSON.parse(row.payload_json);
  assert.equal(snapshot.points.length, 44);
  assert.deepEqual(snapshot.unavailable.map((item: { code: string }) => item.code), ['11.41']);
  assert.deepEqual(snapshot.coverage, { requested: 45, received: 44 });
  assert.equal((await validators()).isForecastSnapshot(snapshot), true);
  assert.equal(await publishForecast(db, now + 9 * 3_600_000, dependencies), false);
});

test('earthquakes publish a valid archive at most every 15 minutes and a failure is retried sooner', async () => {
  const { db, sqlite } = createDatabase();
  const gempa = { DateTime: '2026-10-29T01:00:00+00:00', Coordinates: '-6.1,106.8', Magnitude: '5.4', Kedalaman: '10 km', Wilayah: 'Jawa', Potensi: 'Tidak berpotensi tsunami' };
  let calls = 0;
  const fetcher = (async () => { calls++; return Response.json({ Infogempa: { gempa: [gempa] } }); }) as typeof fetch;
  assert.equal(await refreshEarthquakes(db, now, { fetcher }), true);
  assert.equal(await refreshEarthquakes(db, now + 60_000, { fetcher }), false);
  assert.equal(calls, 1);
  const row = sqlite.prepare('SELECT payload_json FROM publications WHERE key = ?').get(LIVE_KEYS.earthquakes) as { payload_json: string };
  assert.equal((await validators()).isEarthquakeArchive(JSON.parse(row.payload_json)), true);
  const failing = createDatabase();
  assert.equal(await refreshEarthquakes(failing.db, now, { fetcher: (async () => new Response('x', { status: 503 })) as typeof fetch }), false);
  const state = failing.sqlite.prepare('SELECT next_due_at, last_error FROM source_state WHERE source_id = ?').get('live:earthquakes') as { next_due_at: string; last_error: string };
  assert.equal(state.next_due_at, new Date(now + 300_000).toISOString());
  assert.match(state.last_error, /503/);
});

test('history is built in batches, published and keeps the previous one on failure', async () => {
  const points = pointList(45);
  const { db, sqlite } = createDatabase();
  const days = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'];
  const requests: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url.href);
    const count = url.searchParams.get('latitude')!.split(',').length;
    const column = days.map((_, index) => 20 + index);
    const result = { daily: { time: days, temperature_2m_mean: column, temperature_2m_min: column, temperature_2m_max: column, precipitation_sum: column, relative_humidity_2m_mean: column, cloud_cover_mean: column, wind_speed_10m_mean: column } };
    return Response.json(Array.from({ length: count }, () => result));
  }) as typeof fetch;
  assert.equal(await refreshHistory(db, now, { fetcher, sleep: noSleep, points, edition: CODE_EDITION }), true);
  assert.equal(requests.length, 2);
  const row = sqlite.prepare('SELECT payload_json FROM publications WHERE key = ?').get(LIVE_KEYS.history) as { payload_json: string };
  const history = JSON.parse(row.payload_json);
  assert.equal((await validators()).isWeatherHistory(history), true);
  assert.equal(history.days.length, 7);
  assert.equal(history.withHistory, undefined);
  const broken = (async () => new Response('x', { status: 500 })) as typeof fetch;
  assert.equal(await refreshHistory(db, now + 2 * 86_400_000, { fetcher: broken, sleep: noSleep, points, edition: CODE_EDITION }), false);
  const kept = sqlite.prepare('SELECT payload_json FROM publications WHERE key = ?').get(LIVE_KEYS.history) as { payload_json: string };
  assert.equal(kept.payload_json, row.payload_json);
});

test('a tick spends its subrequests wisely: history takes a tick alone, then forecast batches follow', async () => {
  const points = pointList(45);
  const { db } = createDatabase();
  const requests: string[] = [];
  const bmkg = fakeBmkg(points, requests);
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('open-meteo')) {
      requests.push(url);
      return new Response('x', { status: 500 });
    }
    if (url.includes('gempaterkini')) { requests.push(url); return Response.json({ Infogempa: { gempa: [] } }); }
    return bmkg(input, init);
  }) as typeof fetch;
  const dependencies = { fetcher, sleep: noSleep, points, edition: CODE_EDITION };
  const first = await runLiveSnapshots(db, now, dependencies);
  assert.equal(first.history, false);
  assert.equal(first.forecast, undefined);
  const second = await runLiveSnapshots(db, now + 1_200_000, dependencies);
  assert.equal(second.forecast?.attempted, POINTS_PER_TICK);
  assert.ok(requests.length < 50);
});

test('only the exact live paths map to publication keys', () => {
  assert.equal(liveKeyForPath('/data/live/weather/forecast.json'), LIVE_KEYS.forecast);
  assert.equal(liveKeyForPath('/data/live/weather/../../secret'), undefined);
  assert.equal(liveKeyForPath('/data/live/constructor'), undefined);
});

test('nothing new means nothing is rewritten: unchanged forecasts, earthquakes and history are only touched', async () => {
  const points = pointList(45);
  const { db, sqlite } = createDatabase();
  const dependencies = { fetcher: fakeBmkg(points, []), sleep: noSleep, points, edition: CODE_EDITION };

  const first = await refreshForecastBatch(db, now, dependencies);
  assert.equal(first.changed, POINTS_PER_TICK);
  const again = await refreshForecastBatch(db, now + 1_200_000, dependencies);
  assert.equal(again.changed, 15);
  const repeat = await refreshForecastBatch(db, now + 2_400_000, dependencies);
  assert.equal(repeat.succeeded, POINTS_PER_TICK);
  assert.equal(repeat.changed, 0);

  const before = sqlite.prepare('SELECT payload_json, fetched_at FROM forecast_points WHERE code = ?').get('11.01') as { payload_json: string; fetched_at: string };
  await refreshForecastBatch(db, now + 3_600_000, dependencies);
  const after = sqlite.prepare('SELECT payload_json, fetched_at FROM forecast_points WHERE code = ?').get('11.01') as { payload_json: string; fetched_at: string };
  assert.equal(after.payload_json, before.payload_json);
  assert.equal(after.fetched_at >= before.fetched_at, true);

  const gempa = { DateTime: '2026-10-29T01:00:00+00:00', Coordinates: '-6.1,106.8', Magnitude: '5.4', Kedalaman: '10 km', Wilayah: 'Jawa', Potensi: '' };
  const quake = (async () => Response.json({ Infogempa: { gempa: [gempa] } })) as typeof fetch;
  assert.equal(await refreshEarthquakes(db, now, { fetcher: quake }), true);
  assert.equal(await refreshEarthquakes(db, now + 20 * 60_000, { fetcher: quake }), false);
  const archive = sqlite.prepare('SELECT payload_json, generated_at FROM publications WHERE key = ?').get(LIVE_KEYS.earthquakes) as { payload_json: string; generated_at: string };
  assert.equal(JSON.parse(archive.payload_json).fetchedAt, new Date(now + 20 * 60_000).toISOString());
  assert.equal(archive.generated_at, new Date(now + 20 * 60_000).toISOString());
  const another = (async () => Response.json({ Infogempa: { gempa: [gempa, { ...gempa, DateTime: '2026-10-29T02:00:00+00:00' }] } })) as typeof fetch;
  assert.equal(await refreshEarthquakes(db, now + 40 * 60_000, { fetcher: another }), true);

  const day = expectedLastHistoryDay(now);
  assert.equal(day, '2026-10-28');
  sqlite.prepare('INSERT INTO publications (key, payload_json, generated_at, valid_until) VALUES (?, ?, ?, ?)').run(LIVE_KEYS.history, JSON.stringify({ days: ['2026-10-27', day], fetchedAt: 'old' }), new Date(now).toISOString(), new Date(now + 3_600_000).toISOString());
  let providerCalls = 0;
  const counting = (async () => { providerCalls++; return new Response('x', { status: 500 }); }) as typeof fetch;
  assert.equal(await refreshHistory(db, now + 60_000, { fetcher: counting, sleep: noSleep, points, edition: CODE_EDITION }), false);
  assert.equal(providerCalls, 0);
  const touched = sqlite.prepare('SELECT valid_until FROM publications WHERE key = ?').get(LIVE_KEYS.history) as { valid_until: string };
  assert.equal(touched.valid_until, new Date(now + 60_000 + 36 * 3_600_000).toISOString());
});

test('the forecast is republished only when something changed or the last publication is old', async () => {
  const points = pointList(45);
  const { db, sqlite } = createDatabase();
  const dependencies = { fetcher: fakeBmkg(points, []), sleep: noSleep, points, edition: CODE_EDITION };
  const publishedAt = () => (sqlite.prepare('SELECT generated_at FROM publications WHERE key = ?').get(LIVE_KEYS.forecast) as { generated_at: string } | undefined)?.generated_at;
  // History is not due in this test, so every tick refreshes 30 points and the second one publishes.
  sqlite.prepare('INSERT INTO source_state (source_id, next_due_at) VALUES (?, ?)').run('live:history', new Date(now + 30 * 86_400_000).toISOString());
  await runLiveSnapshots(db, now, dependencies);
  assert.equal(publishedAt(), undefined);
  await runLiveSnapshots(db, now + 1_200_000, dependencies);
  const firstPublish = publishedAt();
  assert.ok(firstPublish);
  await runLiveSnapshots(db, now + 2_400_000, dependencies);
  await runLiveSnapshots(db, now + 3_600_000, dependencies);
  assert.equal(publishedAt(), firstPublish);
  await runLiveSnapshots(db, now + 3_600_000 + 3 * 3_600_000, dependencies);
  assert.notEqual(publishedAt(), firstPublish);
});

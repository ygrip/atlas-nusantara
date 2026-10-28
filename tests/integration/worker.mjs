import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const state = await mkdtemp(join(tmpdir(), 'nusantara-worker-test-'));
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
const base = 'http://127.0.0.1:8788';
const environment = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
function wrangler(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: environment, timeout: 60000 });
  if (result.status !== 0) throw Error('Local Wrangler failed: ' + result.stdout + result.stderr);
  return result.stdout;
}
function query(sql) { return JSON.parse(wrangler(['d1', 'execute', 'nusantara-atlas', '--local', '--persist-to', state, '--command', sql, '--json'])); }
async function triggerPublication() {
  const response = await fetch(base + '/cdn-cgi/local/scheduled?format=json');
  assert.equal(response.ok, true);
  assert.equal((await response.json()).outcome, 'ok');
  const manifestResponse = await fetch(base + '/data/published/manifest.json');
  assert.equal(manifestResponse.ok, true, await manifestResponse.clone().text());
  assert.match(manifestResponse.headers.get('cache-control'), /public, max-age=/);
  return await manifestResponse.json();
}
async function withServer(args, verify) {
  let occupied = false;
  try { await fetch(base, { signal: AbortSignal.timeout(500) }); occupied = true; } catch (error) { if (error.name === 'TimeoutError') throw Error('Integration port is occupied or unresponsive.'); }
  if (occupied) throw Error('Integration test port is already occupied.');
  const child = spawn(process.execPath, [cli, ...args], { env: environment });
  let logs = '';
  child.stdout.on('data', data => logs = (logs + data).slice(-8000));
  child.stderr.on('data', data => logs = (logs + data).slice(-8000));
  const ended = new Promise(resolvePromise => child.once('exit', resolvePromise));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw Error('Local Worker exited: ' + logs);
      try { ready = (await fetch(base + '/data/admin-2025/provinces.json', { signal: AbortSignal.timeout(500) })).ok; } catch { ready = false; }
      if (ready) break;
      await sleep(100);
    }
    if (!ready) throw Error('Local Worker startup timed out: ' + logs);
    await verify();
  } catch (error) { throw Error(error.message + '\nWorker diagnostics:\n' + logs); }
  finally {
    child.kill('SIGINT'); await Promise.race([ended, sleep(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
function withWorker(variables, verify) {
  const args = ['dev', '--local', '--test-scheduled', '--persist-to', state, '--port', '8788', '--inspector-port', '9238', ...variables.flatMap(value => ['--var', value])];
  return withServer(args, verify);
}
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const now = new Date().toISOString();
const old = new Date(Date.now() - 366 * 86400000).toISOString();
const cold = new Date(Date.now() - 60 * 86400000).toISOString();
const nextDue = new Date(Date.now() + 86400000).toISOString();
function fixture(id, observedAt, firstSeenAt, sourceId = 'bmkg-earthquakes') {
  const payload = { id, type: 'earthquake', observedAt, regionCodes: [], unmatchedRegionCodes: [], geometry: { type: 'Point', coordinates: [106, -6] }, properties: { magnitude: 5.2, depthKm: 10, place: 'SYNTHETIC INTEGRATION FIXTURE' } };
  return `INSERT INTO observations (id,source_id,kind,observed_at,first_seen_at,last_seen_at,payload_json) VALUES (${[id, sourceId, 'earthquake', observedAt, firstSeenAt, now, JSON.stringify(payload)].map(quote).join(',')});`;
}
try {
  wrangler(['d1', 'migrations', 'apply', 'nusantara-atlas', '--local', '--persist-to', state]);
  // Future due dates ensure this test never calls a provider.
  query(`INSERT INTO source_state(source_id,last_success_at,next_due_at) VALUES ('bmkg-earthquakes',${quote(now)},${quote(nextDue)}),('unapproved-fixture',${quote(now)},${quote(nextDue)});` + fixture('fixture-recent', now, now) + fixture('fixture-cold', cold, cold) + fixture('fixture-old-event', old, now) + fixture('fixture-old-first-seen', now, old) + fixture('fixture-unapproved', now, now, 'unapproved-fixture'));
  // Reuse declarations below apply only to synthetic test data, not BMKG rights.
  await withWorker([
    'APPROVED_SOURCE_IDS:bmkg-earthquakes', 'BMKG_EARTHQUAKES_LICENSE:CC0-1.0',
    'BMKG_EARTHQUAKES_LICENSE_URL:https://example.org/fixture-license',
    'BMKG_EARTHQUAKES_REVIEWED_BY:Integration fixture', 'BMKG_EARTHQUAKES_REVIEWED_AT:' + now
  ], async () => {
    const manifest = await triggerPublication();
    const summary = await (await fetch(base + manifest.summary)).json();
    assert.equal(summary.counts.earthquake, 1);
    assert.equal(summary.hotWindowDays, 30);
    assert.equal(summary.observations[0].id, 'fixture-recent');
    const snapshot = await (await fetch(base + manifest.snapshots.earthquake)).json();
    assert.equal(snapshot.records.length, 1);
    assert.deepEqual(snapshot.records[0].geometry.coordinates, [106, -6]);
    const regions = await (await fetch(base + '/data/admin-2025/cities/32.json')).json();
    assert.equal(regions.regions.length, 27);
    const missing = await fetch(base + '/province/example', { headers: { accept: 'text/html', 'sec-fetch-mode': 'navigate' } });
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /https:\/\/nusantara\.readynaz\.com\//);
    for (const path of ['/?region=96', '/terms/', '/privacy/']) assert.equal((await fetch(base + path)).status, 200);
    for (const path of ['/api/summary', '/api/sources', '/api/regions', '/api/snapshots/earthquake.json']) assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base + '/api/export?kind=earthquake&format=json')).status, 405);
    // Fail closed until a deployment-specific Turnstile secret is configured.
    const denied = await fetch(base + '/api/export', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'earthquake', format: 'json', token: 'not-a-real-token' }) });
    assert.equal(denied.status, 503);
    assert.equal(denied.headers.get('cache-control'), 'no-store');
  });
  await withWorker([], async () => {
    const manifest = await triggerPublication();
    const summary = await (await fetch(base + manifest.summary)).json();
    assert.equal(summary.counts.earthquake, 0);
    assert.deepEqual(summary.observations, []);
    assert.equal(summary.activeWarningCount, null);
    assert.deepEqual(manifest.snapshots, {});
  });
  // Pages shares the local D1 database, but never invokes the scheduler or requires R2.
  await withServer(['pages', 'dev', '--cwd', 'pages', '--persist-to', state, '--port', '8788', '--inspector-port', '9238'], async () => {
    const manifestResponse = await fetch(base + '/data/published/manifest.json');
    assert.equal(manifestResponse.status, 200, await manifestResponse.clone().text());
    assert.equal(manifestResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.match(manifestResponse.headers.get('content-security-policy'), /default-src 'none'/);
    const manifest = await manifestResponse.json();
    const summary = await (await fetch(base + manifest.summary)).json();
    assert.equal(summary.counts.earthquake, 0);
    const head = await fetch(base + manifest.summary, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const path of ['/', '/id/', '/terms/', '/privacy/', '/data/observations/hazards.json']) {
      assert.equal((await fetch(base + path)).status, 200, path);
    }
    assert.equal((await fetch(base + '/does-not-exist', { headers: { accept: 'text/html' } })).status, 404);
    assert.equal((await fetch(base + '/api/summary')).status, 404);
    assert.equal((await fetch(base + '/data/live/hazards.json')).status, 503);
    assert.equal((await fetch(base + '/api/export')).status, 405);
    const archive = await fetch(base + '/api/export', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(archive.status, 503);
    assert.equal(archive.headers.get('cache-control'), 'no-store');
    assert.equal(archive.headers.get('x-frame-options'), 'DENY');
    assert.equal((await fetch(base + '/data/published/manifest.json', { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    const shell = await fetch(base + '/');
    assert.match(shell.headers.get('content-security-policy'), /sha256-/);
    assert.equal((await fetch(base + '/data/published/not-a-publication')).status, 404);
  });
  assert.equal(query("SELECT COUNT(*) AS count FROM observations WHERE id IN ('fixture-old-event','fixture-old-first-seen')")[0].results[0].count, 0);
  assert.equal(query("SELECT COUNT(*) AS count FROM observations WHERE id = 'fixture-cold'")[0].results[0].count, 1);
  const budgetDay = now.slice(0, 10);
  const debit = `INSERT INTO archive_download_budget(day,downloads) VALUES (${quote(budgetDay)},1) ON CONFLICT(day) DO UPDATE SET downloads = downloads + 1 WHERE downloads < 20 RETURNING downloads;`;
  query(debit.repeat(21));
  assert.equal(query(`SELECT downloads FROM archive_download_budget WHERE day = ${quote(budgetDay)}`)[0].results[0].downloads, 20);
  const older = new Date(Date.now() - 61 * 86400000).toISOString();
  const newer = new Date(Date.now() - 59 * 86400000).toISOString();
  const selected = query(`SELECT id FROM observations WHERE kind = 'earthquake' AND source_id IN ('bmkg-earthquakes') AND COALESCE(observed_at,first_seen_at) >= ${quote(older)} AND COALESCE(observed_at,first_seen_at) < ${quote(newer)} AND (COALESCE(observed_at,first_seen_at),id) > ('','') ORDER BY COALESCE(observed_at,first_seen_at),id LIMIT 500`);
  assert.deepEqual(selected[0].results.map(row => row.id), ['fixture-cold']);
  console.log('Local Worker/Pages/D1 integration passed: D1 hot publications, source filtering, retention deletion, protected cold export, static hierarchy, known routes and HTTP 404 routing. No remote resources, provider calls or live Siteverify calls.');
} finally { await rm(state, { recursive: true, force: true }); }

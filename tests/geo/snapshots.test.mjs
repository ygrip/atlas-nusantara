import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSavedSnapshot, snapshotCandidates } from '../../src/lib/data/saved-snapshot.ts';
import { isForecastSnapshot } from '../../src/lib/map/weather.ts';
import { isEarthquakeArchive } from '../../src/lib/data/earthquakes.ts';

for (const origin of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?token=x']) {
  test(`snapshot CDN rejects unsafe origin ${new URL(origin).host}`, () => {
    assert.throws(() => snapshotCandidates('/data/weather/forecast.json', origin));
  });
}

test('CDN snapshot keys are stable while the local release fallback keeps its version key', () => {
  assert.deepEqual(snapshotCandidates('/data/weather/forecast.json?v=release', 'https://snapshots.example'), ['https://snapshots.example/data/weather/forecast.json', '/data/weather/forecast.json?v=release']);
  assert.throws(() => snapshotCandidates('//example.com/private'));
});

test('invalid CDN data falls back to the dated release snapshot without credentials', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([String(url), options.credentials]);
    if (String(url).startsWith('https:')) return Response.json({ wrong: true });
    return Response.json({ valid: true });
  };
  const accept = value => value?.valid === true;
  const data = await loadSavedSnapshot('/data/weather/forecast.json?v=release', accept, undefined, 'https://snapshots.example');
  assert.deepEqual(data, { valid: true });
  assert.deepEqual(requests, [['https://snapshots.example/data/weather/forecast.json', 'omit'], ['/data/weather/forecast.json?v=release', 'omit']]);
});

test('unavailable live hazards close the response before using the separate dated asset', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requests = [];
  let discarded = false;
  globalThis.fetch = async url => {
    requests.push(String(url));
    if (url === '/data/live/hazards.json') {
      const body = new ReadableStream({ cancel() { discarded = true; } });
      return new Response(body, { status: 503 });
    }
    assert.equal(discarded, true, 'release the unfinished error body before the fallback request');
    return Response.json({ saved: true });
  };
  const data = await loadSavedSnapshot('/data/observations/hazards.json?v=release', value => value?.saved === true);
  assert.deepEqual(data, { saved: true });
  assert.deepEqual(requests, ['/data/live/hazards.json', '/data/observations/hazards.json?v=release']);
});

test('both shipped snapshot schemas pass validation', async () => {
  const forecast = JSON.parse(await readFile('static/data/weather/forecast.json', 'utf8'));
  const quakes = JSON.parse(await readFile('static/data/observations/earthquakes.json', 'utf8'));
  assert.equal(isForecastSnapshot(forecast), true);
  assert.equal(isEarthquakeArchive(quakes), true);
  forecast.points[0].steps[0].ws = 'not a wind speed';
  assert.equal(isForecastSnapshot(forecast), false);
  quakes.events[0].lon = 500;
  assert.equal(isEarthquakeArchive(quakes), false);
});

test('refresh schedules keep weather and earthquake collection independent', async () => {
  const workflow = await readFile('.github/workflows/refresh-snapshots.yml', 'utf8');
  assert.match(workflow, /cron: '0 \*\/3 \* \* \*'/);
  assert.match(workflow, /cron: '\*\/25 \* \* \* \*'/);
  assert.match(workflow, /SNAPSHOT_REFRESH_ENABLED/);
  assert.match(workflow, /SNAPSHOT_PUBLISH_APPROVED/);
  assert.doesNotMatch(workflow, /git push|git commit/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { publishHot, serveHot } from '../../cloudflare/publication.ts';
import worker from '../../cloudflare/worker.ts';

function bucketStub() {
  const files = new Map();
  const events = [];
  let sequence = 0;
  let failPayload = false;
  let concurrentWinner;
  return {
    files, events,
    setFailPayload() { failPayload = true; },
    setConcurrentWinner(generatedAt) { concurrentWinner = generatedAt; },
    async put(key, value, options = {}) {
      events.push(key);
      if (failPayload && key !== 'data/published/manifest.json') throw Error('synthetic payload failure');
      if (options.onlyIf && concurrentWinner && key === 'data/published/manifest.json') {
        const previous = files.get(key);
        files.set(key, { ...previous, etag: 'concurrent-etag', customMetadata: { ...previous.customMetadata, generatedAt: concurrentWinner } });
        concurrentWinner = undefined;
      }
      const previous = files.get(key);
      if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null;
      if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
      const record = { key, value, customMetadata: options.customMetadata ?? {}, etag: 'etag-' + (++sequence) };
      files.set(key, record);
      return record;
    },
    async head(key) { return files.get(key) ?? null; },
    async get(key) {
      const record = files.get(key);
      if (!record) return null;
      return { body: new Response(record.value).body, httpEtag: record.etag, customMetadata: record.customMetadata,
        writeHttpMetadata(headers) { headers.set('content-type', 'application/json'); } };
    }
  };
}
function snapshot(fetchedAt, validUntil = null) {
  return { schemaVersion: 1, generatedAt: fetchedAt, records: [], provenance: {
    source: 'BMKG', sourceUrl: 'https://example.org/fixture', fetchedAt, sourcePublishedAt: fetchedAt, validUntil,
    license: 'CC0-1.0', licenseUrl: 'https://example.org/fixture-license', reviewedBy: 'Synthetic test', reviewedAt: fetchedAt, coverage: [], edition: null
  } };
}

test('hot publication writes payloads first and promotes the manifest last', async () => {
  const bucket = bucketStub();
  const now = Date.now();
  const result = await publishHot(bucket, { counts: {} }, { warning: snapshot(new Date(now).toISOString()) }, now);
  assert.equal(bucket.events[0].endsWith('/summary.json'), true);
  assert.equal(bucket.events[1].endsWith('/warning.json'), true);
  assert.equal(bucket.events.at(-1), 'data/published/manifest.json');
  assert.equal(JSON.parse(bucket.files.get('data/published/manifest.json').value).revision, result.revision);
});

test('payload failures and concurrent publishers never overwrite the committed newer manifest', async () => {
  for (const scenario of ['payload-failure', 'concurrent-winner']) {
    const bucket = bucketStub();
    const now = Date.now();
    await publishHot(bucket, { initial: true }, {}, now);
    const previous = bucket.files.get('data/published/manifest.json').value;
    if (scenario === 'payload-failure') {
      bucket.setFailPayload();
      await assert.rejects(publishHot(bucket, {}, {}, now + 1000), /synthetic payload failure/);
    } else {
      const newerAt = new Date(now + 2000).toISOString();
      bucket.setConcurrentWinner(newerAt);
      await publishHot(bucket, {}, {}, now + 1000);
      assert.equal(bucket.files.get('data/published/manifest.json').customMetadata.generatedAt, newerAt);
    }
    assert.equal(bucket.files.get('data/published/manifest.json').value, previous);
  }
});

test('warning publication expires at CAP expiry and never extends source freshness', async () => {
  const now = Date.now();
  for (const expiry of [now + 60000, now + 3600000]) {
    const result = await publishHot(bucketStub(), {}, { warning: snapshot(new Date(now).toISOString(), new Date(expiry).toISOString()) }, now);
    assert.equal(Date.parse(result.validUntil), Math.min(expiry, now + 15 * 60000));
  }
});

test('expired hot objects are unavailable rather than served stale', async () => {
  const bucket = bucketStub();
  const key = 'data/published/123e4567-e89b-42d3-a456-426614174000/summary.json';
  await bucket.put(key, '{}', { customMetadata: { validUntil: new Date(Date.now() - 1).toISOString() } });
  const response = await serveHot(new Request('https://nusantara.readynaz.com/' + key), bucket);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('hot reads and removed legacy APIs never access D1', async () => {
  let d1Calls = 0;
  let objectReads = 0;
  const env = { LOCAL_HOT_DATA_FALLBACK: 'true', DB: { prepare() { d1Calls += 1; throw Error('Unexpected D1 read'); } }, HOT_DATA: { async get() {
    objectReads += 1;
    return { body: new Response('{}').body, httpEtag: 'fixture', customMetadata: { validUntil: new Date(Date.now() + 60000).toISOString() }, writeHttpMetadata() {} };
  } } };
  for (const path of ['/api/summary', '/api/sources', '/api/regions', '/api/snapshots/earthquake.json']) assert.equal((await worker.fetch(new Request('https://nusantara.readynaz.com' + path), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://nusantara.readynaz.com/data/published/manifest.json'), { ...env, LOCAL_HOT_DATA_FALLBACK: 'false' })).status, 404);
  assert.equal(objectReads, 0);
  assert.equal((await worker.fetch(new Request('http://127.0.0.1/data/published/manifest.json'), env)).status, 200);
  assert.equal(objectReads, 1);
  assert.equal(d1Calls, 0);
});

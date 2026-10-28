import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearPublicationCache, loadPublished, PublicationUnavailableError } from '../../src/lib/data/publication.ts';

globalThis.location = new URL('http://127.0.0.1/');
const revision = '123e4567-e89b-42d3-a456-426614174000';
const future = new Date(Date.now() + 900_000).toISOString();
function manifest(overrides = {}) {
  return { schemaVersion: 1, revision, generatedAt: new Date().toISOString(), validUntil: future,
    summary: `/data/published/${revision}/summary.json`, snapshots: { earthquake: `/data/published/${revision}/earthquake.json` }, ...overrides };
}
function stubFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const body = responses.get(String(url));
    if (!body) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json(body);
  };
  return calls;
}

test('production uses same-origin Pages publications without a separate CDN', async () => {
  clearPublicationCache();
  globalThis.location = new URL('https://nusantara.readynaz.com/');
  const calls = stubFetch(new Map([
    ['/data/published/manifest.json', manifest()],
    [`/data/published/${revision}/summary.json`, { counts: {} }]
  ]));
  try {
    const result = await loadPublished('summary');
    assert.deepEqual(result.data, { counts: {} });
    assert.deepEqual(calls.map(call => call.url), ['/data/published/manifest.json', `/data/published/${revision}/summary.json`]);
  } finally {
    globalThis.location = new URL('http://127.0.0.1/');
    clearPublicationCache();
  }
});

test('loads only versioned static publication pointers and rejects an expired manifest', async () => {
  clearPublicationCache();
  const root = ''
  const calls = stubFetch(new Map([
    [`${root}/data/published/manifest.json`, manifest()],
    [`${root}/data/published/${revision}/summary.json`, { generatedAt: new Date().toISOString(), counts: {} }]
  ]));
  const result = await loadPublished('summary');
  assert.equal(result.validUntil, future);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.url.startsWith('/data/published/')));

  clearPublicationCache();
  stubFetch(new Map([[`${root}/data/published/manifest.json`, manifest({ validUntil: '2000-01-01T00:00:00.000Z' })]]));
  await assert.rejects(loadPublished('summary'), PublicationUnavailableError);
});

test('rejects path traversal, missing snapshots and snapshots with a different kind', async () => {
  clearPublicationCache();
  const root = ''
  stubFetch(new Map([[`${root}/data/published/manifest.json`, manifest({ summary: `/data/published/${revision}/../secret.json` })]]));
  await assert.rejects(loadPublished('summary'), /pointer is invalid/);

  clearPublicationCache();
  stubFetch(new Map([[`${root}/data/published/manifest.json`, manifest({ snapshots: {} })]]));
  await assert.rejects(loadPublished('warning'), /No published snapshot/);

  clearPublicationCache();
  stubFetch(new Map([
    [`${root}/data/published/manifest.json`, manifest()],
    [`${root}/data/published/${revision}/earthquake.json`, { schemaVersion: 1, records: [{ type: 'warning' }] }]
  ]));
  await assert.rejects(loadPublished('earthquake'), /does not match/);
});

test('one caller aborting a payload does not cancel the shared manifest request', async () => {
  clearPublicationCache();
  const root = ''
  let releaseManifest;
  let manifestCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/manifest.json')) {
      manifestCalls += 1;
      await new Promise(resolve => { releaseManifest = resolve; });
      return Response.json(manifest());
    }
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return Response.json({ generatedAt: new Date().toISOString(), counts: {} });
  };
  const abort = new AbortController();
  const cancelled = loadPublished('summary', abort.signal);
  const surviving = loadPublished('summary');
  abort.abort();
  releaseManifest();
  await assert.rejects(cancelled, { name: 'AbortError' });
  await surviving;
  assert.equal(manifestCalls, 1);
});

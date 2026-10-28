import assert from 'node:assert/strict';
import test from 'node:test';
import { secureApiResponse } from '../../cloudflare/security.ts';
import { cachedPublication } from '../../cloudflare/publication-cache.ts';
import { onRequest } from '../../pages/functions/[[path]].ts';

test('all API statuses keep security headers and preserve streaming content', async () => {
  for (const status of [200, 403, 404, 405, 429, 503]) {
    const response = secureApiResponse(new Response('fixture', { status }));
    assert.equal(response.status, status);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(await response.text(), 'fixture');
  }
});

test('Pages rejects cross-site reads, invalid paths, and methods before touching D1', async () => {
  let reads = 0;
  const env = { DB: { prepare() { reads += 1; throw Error('Unexpected database access'); } }, HAZARD_SOURCE_IDS: '' };
  const cases = [
    { path: '/data/published/manifest.json', headers: { 'sec-fetch-site': 'cross-site' }, status: 403 },
    { path: '/data/published/not-a-publication', status: 404 },
    { path: '/data/published/manifest.json', method: 'POST', status: 405 },
    { path: '/api/export', status: 405 },
    { path: '/api/summary', status: 404 }
  ];
  for (const entry of cases) {
    const request = new Request('https://nusantara.readynaz.com' + entry.path, { method: entry.method, headers: entry.headers });
    const response = await onRequest({ request, env });
    assert.equal(response.status, entry.status, entry.path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  assert.equal(reads, 0);
});

test('public publication cache ignores query strings, supports HEAD, and rejects expired entries', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'caches', original);
    else delete globalThis.caches;
  });
  const entries = new Map();
  const cache = {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { entries.set(key.url, response.clone()); },
    async delete(key) { return entries.delete(key.url); }
  };
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: cache } });
  let reads = 0;
  const load = async () => {
    reads += 1;
    return Response.json({ fixture: true }, { headers: {
      'cache-control': 'public, max-age=60, must-revalidate',
      'x-publication-valid-until': new Date(Date.now() + 60_000).toISOString()
    } });
  };
  const base = 'https://nusantara.readynaz.com/data/published/manifest.json';
  await cachedPublication({ request: new Request(base + '?unused=1') }, load);
  const hit = await cachedPublication({ request: new Request(base + '?unused=2') }, load);
  assert.deepEqual(await hit.json(), { fixture: true });
  const head = await cachedPublication({ request: new Request(base, { method: 'HEAD' }) }, load);
  assert.equal(await head.text(), '');
  assert.equal(reads, 1);
  entries.set(base, Response.json({}, { headers: { 'x-publication-valid-until': new Date(0).toISOString() } }));
  await cachedPublication({ request: new Request(base) }, load);
  assert.equal(reads, 2);
});

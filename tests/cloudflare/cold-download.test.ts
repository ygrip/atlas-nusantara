import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyArchiveRequest } from '../../cloudflare/cold-download.ts';
import { exportFitsBudget } from '../../cloudflare/export.ts';
import type { ArchiveRequest, ColdDownloadEnv } from '../../cloudflare/cold-download.ts';

const origin = 'https://nusantara.readynaz.com';
const today = new Date().toISOString().slice(0, 10);
const start = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
function env(overrides: Partial<ColdDownloadEnv> = {}) {
  const calls: string[] = [];
  const limiter = (name: string) => ({ async limit() { calls.push(name); return { success: true }; } });
  const value: ColdDownloadEnv = {
    TURNSTILE_SECRET: 'synthetic-test-secret',
    TURNSTILE_HOSTNAMES: 'nusantara.readynaz.com',
    COLD_REQUEST_LIMITER: limiter('request'),
    COLD_BUDGET_LIMITER: limiter('budget'),
    COLD_EXPORT_LIMITER: limiter('export'),
    ...overrides
  };
  return { value, calls };
}
function request(options: { method?: string; originHeader?: string | null; contentType?: string; body?: unknown; ip?: string | null } = {}) {
  const body = options.body ?? { kind: 'earthquake', format: 'json', token: 'synthetic-test-token', from: start, to: today };
  const headers = new Headers();
  if (options.originHeader !== null) headers.set('origin', options.originHeader ?? origin);
  if (options.contentType !== undefined) headers.set('content-type', options.contentType);
  else headers.set('content-type', 'application/json');
  if (options.ip !== null) headers.set('cf-connecting-ip', options.ip ?? '127.0.0.1');
  const method = options.method ?? 'POST';
  let payload: string | undefined;
  if (method !== 'GET') {
    if (typeof body === 'string') payload = body;
    else payload = JSON.stringify(body);
  }
  return new Request(origin + '/api/export', { method, headers, body: payload });
}
function siteverify(result: unknown = { success: true, action: 'archive_download', hostname: 'nusantara.readynaz.com' }) {
  const calls: { url: string; body: URLSearchParams; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const form = new URLSearchParams(String(init?.body));
    calls.push({ url, body: form, init: init ?? {} });
    return Response.json(result);
  };
  return { fetcher, calls };
}

test('siteverify gates cold downloads and returns only the selected bounded archive window', async () => {
  const { value, calls: limiterCalls } = env();
  const verifier = siteverify();
  const result = await verifyArchiveRequest(request(), value, verifier.fetcher);
  assert.deepEqual(result, { kind: 'earthquake', format: 'json', from: new Date(start + 'T00:00:00Z').toISOString(), to: new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString() } satisfies ArchiveRequest);
  assert.equal(verifier.calls.length, 1);
  assert.equal(verifier.calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(verifier.calls[0].init.method, 'POST');
  assert.equal(verifier.calls[0].body.get('secret'), 'synthetic-test-secret');
  assert.equal(verifier.calls[0].body.get('response'), 'synthetic-test-token');
  assert.equal(verifier.calls[0].body.get('remoteip'), '127.0.0.1');
  assert.deepEqual(limiterCalls, ['request', 'export', 'budget']);
});

test('omitted archive dates use bounded 30-day defaults', async () => {
  const before = Date.now();
  const verifier = siteverify();
  const result = await verifyArchiveRequest(request({ body: { kind: 'warning', format: 'csv', token: 'synthetic-test-token' } }), env().value, verifier.fetcher);
  const after = Date.now();
  assert.ok(!(result instanceof Response));
  assert.equal(result.kind, 'warning');
  assert.equal(result.format, 'csv');
  assert.equal(Date.parse(result.to) - Date.parse(result.from), 31 * 86400000);
  assert.ok(Date.parse(result.to) >= Date.parse(new Date(before).toISOString().slice(0, 10) + 'T00:00:00.000Z') + 86400000);
  assert.ok(Date.parse(result.to) <= Date.parse(new Date(after).toISOString().slice(0, 10) + 'T00:00:00.000Z') + 86400000);
  assert.equal(verifier.calls.length, 1);
});

test('invalid verification claims and siteverify failures fail closed', async () => {
  const invalid = [
    { success: false, action: 'archive_download', hostname: 'nusantara.readynaz.com' },
    { success: true, action: 'other', hostname: 'nusantara.readynaz.com' },
    { success: true, action: 'archive_download', hostname: 'evil.example' }
  ];
  for (const result of invalid) {
    const verifier = siteverify(result);
    const response = await verifyArchiveRequest(request(), env().value, verifier.fetcher);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 403);
  }
  for (const failure of [async () => new Response('down', { status: 503 }), async () => { throw Error('network'); }]) {
    const response = await verifyArchiveRequest(request(), env().value, failure as typeof fetch);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 403);
  }
});

test('a consumed Turnstile token cannot be replayed for another archive request', async () => {
  let attempts = 0;
  const verifier: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) return Response.json({ success: true, action: 'archive_download', hostname: 'nusantara.readynaz.com' });
    return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  };
  const first = await verifyArchiveRequest(request(), env().value, verifier);
  const second = await verifyArchiveRequest(request(), env().value, verifier);
  assert.ok(!(first instanceof Response));
  assert.ok(second instanceof Response);
  assert.equal(second.status, 403);
});

test('method, origin, configuration and token validation stop before siteverify', async () => {
  const cases: Array<{ request: Request; env?: Partial<ColdDownloadEnv>; status: number }> = [
    { request: request({ method: 'GET' }), status: 405 },
    { request: request({ originHeader: 'https://evil.example' }), status: 403 },
    { request: request({ originHeader: null }), status: 403 },
    { request: request(), env: { TURNSTILE_SECRET: undefined }, status: 503 },
    { request: request({ body: { kind: 'earthquake', format: 'json', token: '' } }), status: 400 },
    { request: request({ body: { kind: 'earthquake', format: 'json', token: 'x'.repeat(2049) } }), status: 400 }
  ];
  for (const item of cases) {
    const verifier = siteverify();
    const response = await verifyArchiveRequest(item.request, env(item.env).value, verifier.fetcher);
    assert.ok(response instanceof Response);
    assert.equal(response.status, item.status);
    assert.equal(verifier.calls.length, 0);
  }
});

test('request rate limit runs before body parsing and verification', async () => {
  const { value, calls } = env({ COLD_REQUEST_LIMITER: { async limit() { calls.push('denied'); return { success: false }; } } });
  let fetches = 0;
  const response = await verifyArchiveRequest(request(), value, async () => { fetches += 1; return Response.json({}); });
  assert.ok(response instanceof Response);
  assert.equal(response.status, 429);
  assert.equal(fetches, 0);
  assert.deepEqual(calls, ['denied']);
});

test('archive windows reject malformed, future, older-than-retention and over-wide ranges', async () => {
  const invalidBodies = [
    { kind: 'earthquake', format: 'json', token: 'test', from: '2026-02-30', to: today },
    { kind: 'earthquake', format: 'json', token: 'test', from: today, to: '2999-01-01' },
    { kind: 'earthquake', format: 'json', token: 'test', from: new Date(Date.now() - 366 * 86400000).toISOString().slice(0, 10), to: today },
    { kind: 'earthquake', format: 'json', token: 'test', from: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10), to: today }
  ];
  for (const body of invalidBodies) {
    const verifier = siteverify();
    const response = await verifyArchiveRequest(request({ body }), env().value, verifier.fetcher);
    assert.ok(response instanceof Response);
    assert.equal(response.status, 400);
    assert.equal(verifier.calls.length, 0);
  }
});

test('export row and byte budgets reject excess work before streaming', async () => {
  for (const result of [{ count: 20001, bytes: 10 }, { count: 1, bytes: 10000001 }, { count: 0, bytes: 0 }]) {
    const db = { prepare() { return { bind() { return { async all<T>() { return { results: [result as T] }; } }; } }; } };
    assert.equal(await exportFitsBudget(db, 'earthquake', ['bmkg-earthquakes'], Date.now(), { from: start, to: today }), result.count === 0);
  }
  const attributionHeavy = { prepare() { return { bind() { return { async all<T>() { return { results: [{ count: 20000, bytes: 1000 } as T] }; } }; } }; } };
  assert.equal(await exportFitsBudget(attributionHeavy, 'earthquake', ['bmkg-earthquakes'], Date.now(), { from: start, to: today }, [{ id: 'bmkg-earthquakes', sourceUrl: 'https://example.org/source', termsUrl: 'https://example.org/terms', license: 'CC0-1.0', licenseUrl: 'https://example.org/' + 'x'.repeat(2000) }]), false);
  assert.equal(await exportFitsBudget({ prepare() { throw Error('D1 must not run without an approved source'); } }, 'earthquake', [], Date.now(), { from: start, to: today }), false);
});

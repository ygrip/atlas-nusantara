import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  applySecurityHeaders,
  createBuildPolicy,
  createContentSecurityPolicy,
  hashInlineScripts,
  validateHttpsOrigin
} from '../../scripts/security-headers.mjs';

const adsConfig = {
  enabled: true,
  testMode: true,
  frameOrigins: [
    'https://googleads.g.doubleclick.net',
    'https://tpc.googlesyndication.com',
    'https://*.safeframe.googlesyndication.com'
  ]
};

function hash(content) {
  return `'sha256-${createHash('sha256').update(content).digest('base64')}'`;
}

test('hashes exact inline script content and skips external or empty scripts', () => {
  const inline = ' window.turnstile = true;\n';
  const other = 'window.ads = true;';
  const html = `<script>${inline}</script><script src="/app.js">ignore me</script><script>   </script><script type="application/ld+json">${other}</script>`;
  assert.deepEqual(hashInlineScripts(html), [hash(inline)]);
  assert.deepEqual(hashInlineScripts('<script type="application/json">{ "x": 1 }</script><script type="application/ld+json">{ "@type": "WebSite" }</script>'), []);
});

test('CSP is default-deny, allows Turnstile, test ads, external catalogue images and inline hashes', () => {
  const policy = createContentSecurityPolicy({ scriptHashes: [hash('inline')], adsConfig });
  assert.match(policy, /default-src 'none'/);
  assert.ok(policy.includes(hash('inline')));
  assert.match(policy, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(policy, /script-src[^;]*https:\/\/pagead2\.googlesyndication\.com/);
  assert.match(policy, /style-src 'self' 'unsafe-inline'/);
  assert.match(policy, /img-src 'self' data: blob: https:/);
  assert.match(policy, /(?:^|; )media-src 'self'(?:;|$)/);
  assert.match(policy, /frame-src[^;]*https:\/\/\*\.safeframe\.googlesyndication\.com/);
  assert.match(policy, /connect-src[^;]*https:\/\/googleads\.g\.doubleclick\.net/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /unsafe-eval|script-src[^;]*unsafe-inline/);
});

test('ad origins are excluded when ads are disabled and data origins require HTTPS', () => {
  const policy = createContentSecurityPolicy({ scriptHashes: [], adsConfig: { enabled: false, testMode: true, frameOrigins: [] } });
  assert.doesNotMatch(policy, /googlesyndication|doubleclick/);
  const withData = createContentSecurityPolicy({ scriptHashes: [], adsConfig: { enabled: false, testMode: true, frameOrigins: [] }, dataOrigins: ['https://data.example.test'] });
  assert.match(withData, /connect-src[^;]*https:\/\/data\.example\.test/);
  for (const origin of ['http://data.example.test', 'https://user:pass@example.test', 'https://example.test/path', 'https://example.test/?x=1']) {
    assert.throws(() => validateHttpsOrigin(origin), /HTTPS|origin/);
  }
  assert.throws(() => validateHttpsOrigin('https://*.example.test'), /wildcard/);
  assert.equal(validateHttpsOrigin('https://*.example.test', true), 'https://*.example.test');
});

test('oversized CSP fails instead of exceeding the Pages header-line limit', () => {
  const hashes = [];
  for (let index = 0; index < 100; index += 1) hashes.push(hash(`inline script ${index}`));
  assert.throws(() => createContentSecurityPolicy({ scriptHashes: hashes, adsConfig: { enabled: false, testMode: true, frameOrigins: [] } }), /2000-byte/);
});

test('build policy hashes every HTML file and supports optional HTTPS data origins', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nusantara-csp-'));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'nested'));
  await writeFile(join(directory, 'index.html'), '<script>one()</script>');
  await writeFile(join(directory, 'nested', '404.html'), '<script>two()</script><script src="/external.js"></script>');
  const policy = await createBuildPolicy({
    buildDirectory: directory,
    adsConfig: { enabled: false, testMode: true, frameOrigins: [] },
    environment: { VITE_PUBLIC_DATA_ORIGIN: 'https://data.example.test', VITE_PUBLIC_SNAPSHOT_ORIGIN: '' }
  });
  assert.ok(policy.includes(hash('one()')));
  assert.ok(policy.includes(hash('two()')));
  assert.match(policy, /connect-src[^;]*https:\/\/data\.example\.test/);
  await assert.rejects(createBuildPolicy({
    buildDirectory: directory,
    adsConfig: { enabled: false, testMode: true, frameOrigins: [] },
    environment: { VITE_PUBLIC_DATA_ORIGIN: 'http://data.example.test' }
  }), /HTTPS/);
  const empty = await mkdtemp(join(tmpdir(), 'nusantara-no-html-'));
  t.after(async () => rm(empty, { recursive: true, force: true }));
  await assert.rejects(createBuildPolicy({ buildDirectory: empty, adsConfig, environment: {} }), /No built HTML files/);
});

test('security headers replace one CSP deterministically and reject duplicates', () => {
  const original = '/*\n  Strict-Transport-Security: max-age=31536000\n  Content-Security-Policy: old\n  X-Frame-Options: DENY\n/\n  Cache-Control: no-store\n';
  const first = applySecurityHeaders(original, "default-src 'none'");
  assert.match(first, /Strict-Transport-Security: max-age=31536000/);
  assert.match(first, /Content-Security-Policy: default-src 'none'/);
  assert.equal(applySecurityHeaders(first, "default-src 'none'"), first);
  const withoutPolicy = applySecurityHeaders('/*\n  X-Frame-Options: DENY\n/\n  Cache-Control: no-store\n', "default-src 'none'");
  assert.match(withoutPolicy, /\/\*\n  Content-Security-Policy: default-src 'none'\n  X-Frame-Options: DENY/);
  assert.throws(() => applySecurityHeaders(`${original}  Content-Security-Policy: extra\n`, "default-src 'none'"), /Multiple Content-Security-Policy/);
  assert.throws(() => applySecurityHeaders(original, 'x'.repeat(2000)), /2000-byte/);
});

test('static headers preserve cache rules and do not enable cross-origin isolation', async () => {
  const headers = await readFile(new URL('../../static/_headers', import.meta.url), 'utf8');
  assert.match(headers, /Strict-Transport-Security: max-age=31536000/);
  assert.match(headers, /Content-Security-Policy: __GENERATED_CSP__/);
  assert.match(headers, /\/_app\/immutable\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /Cross-Origin-Embedder-Policy/);
});
